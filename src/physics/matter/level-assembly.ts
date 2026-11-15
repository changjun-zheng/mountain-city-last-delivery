import {
  createGrayboxCore,
  type GrayboxCore,
  type GrayboxCoreDestroyResult,
  type GrayboxCoreOptions,
} from '../../core/graybox.ts';
import {
  validatePrototypeLevelDefinition,
  type PrototypeLevelDefinition,
} from '../../core/prototype-level.ts';
import { FirstLevelMatterWorld } from './first-level-world.ts';
import type { MatterLibrary } from './graybox-world.ts';

export type PrototypeLevelAssemblyFaultPoint =
  | 'after-engine'
  | 'after-world'
  | 'after-core'
  | 'cleanup-core'
  | 'cleanup-world'
  | 'cleanup-engine';

export type PrototypeLevelAssemblyOptions = Readonly<{
  coreOptions: GrayboxCoreOptions;
  advance?: (engine: MatterJS.Engine, deltaMs: number) => void;
  faultInjector?: (point: PrototypeLevelAssemblyFaultPoint) => void;
}>;

export type PrototypeLevelAssemblyDestroyResult = Readonly<{
  status:
    | 'destroyed'
    | 'already-destroyed'
    | 'blocked'
    | 'cleanup-failed';
  message: string;
  errors: readonly string[];
  core: GrayboxCoreDestroyResult;
}>;

export type PrototypeLevelAssembly = Readonly<{
  definition: PrototypeLevelDefinition;
  engine: MatterJS.Engine;
  world: FirstLevelMatterWorld;
  core: GrayboxCore;
  destroy(): PrototypeLevelAssemblyDestroyResult;
  readonly resources: Readonly<{
    engineOwned: boolean;
    engineCleared: boolean;
    worldDisposed: boolean;
    coreDestroyed: boolean;
    worldOwnedBodyCount: number;
  }>;
}>;

/**
 * Creates one isolated Matter Engine and wires it through the shared core.
 * Validation happens before Engine or Body allocation. Any later assembly
 * failure is unwound in reverse ownership order.
 */
export function createPrototypeLevelAssembly(
  matter: MatterLibrary,
  definitionInput: unknown,
  options: PrototypeLevelAssemblyOptions,
): PrototypeLevelAssembly {
  // This is the single pre-allocation validation gate for callers.
  const definition = validatePrototypeLevelDefinition(definitionInput);
  let engine: MatterJS.Engine | undefined;
  let world: FirstLevelMatterWorld | undefined;
  let core: GrayboxCore | undefined;
  let engineCleared = false;
  let assemblyDestroyed = false;
  try {
    engine = matter.Engine.create();
    options.faultInjector?.('after-engine');
    world = new FirstLevelMatterWorld(
      matter,
      engine,
      deltaMs => {
        (options.advance ?? defaultAdvance(matter))(engine!, deltaMs);
      },
      definition,
    );
    options.faultInjector?.('after-world');
    core = createGrayboxCore(world, {
      ...options.coreOptions,
      interactionObjects:
        options.coreOptions.interactionObjects ?? definition.interactions,
    });
    options.faultInjector?.('after-core');
    const initial = core.snapshot.checkpointSnapshot;
    if (initial.status !== 'READY') {
      throw new Error(
        `Prototype level initial snapshot is not READY: ` +
        `${initial.error ?? 'unknown capture failure'}.`,
      );
    }
  } catch (error) {
    const cleanupErrors = cleanupAssembly(
      matter,
      core,
      world,
      engine,
      options.faultInjector,
    );
    engineCleared = cleanupErrors.engineCleared;
    if (cleanupErrors.errors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors.errors],
        'Prototype level assembly failed and cleanup was incomplete.',
      );
    }
    throw error;
  }

  if (!engine || !world || !core) {
    throw new Error('Prototype level assembly did not create every owned layer.');
  }

  const assembledEngine = engine;
  const assembledWorld = world;
  const assembledCore = core;
  return Object.freeze({
    definition,
    engine: assembledEngine,
    world: assembledWorld,
    core: assembledCore,
    destroy(): PrototypeLevelAssemblyDestroyResult {
      if (assemblyDestroyed && engineCleared) {
        return Object.freeze({
          status: 'already-destroyed' as const,
          message: 'Prototype level assembly was already destroyed.',
          errors: Object.freeze([]),
          core: Object.freeze({
            status: 'already-destroyed' as const,
            message: 'Runtime core was already destroyed.',
            errors: Object.freeze([]),
          }),
        });
      }
      const coreResult = assembledCore.destroy();
      if (coreResult.status === 'blocked') {
        return Object.freeze({
          status: 'blocked' as const,
          message: coreResult.message,
          errors: coreResult.errors,
          core: coreResult,
        });
      }
      const errors: string[] = [];
      if (!assembledWorld.disposed) {
        try {
          options.faultInjector?.('cleanup-core');
          options.faultInjector?.('cleanup-world');
          assembledWorld.dispose();
        } catch (error) {
          errors.push(asMessage(error));
        }
      }
      if (!engineCleared) {
        try {
          options.faultInjector?.('cleanup-engine');
          clearOwnedEngine(matter, assembledEngine);
          engineCleared = true;
        } catch (error) {
          errors.push(asMessage(error));
        }
      }
      if (errors.length > 0) {
        return Object.freeze({
          status: 'cleanup-failed' as const,
          message: 'Prototype level cleanup left residual resources.',
          errors: Object.freeze(errors),
          core: coreResult,
        });
      }
      assemblyDestroyed = true;
      return Object.freeze({
        status: 'destroyed' as const,
        message: 'Prototype level assembly destroyed in core/world/engine order.',
        errors: Object.freeze([]),
        core: coreResult,
      });
    },
    get resources() {
      return Object.freeze({
        engineOwned: true,
        engineCleared,
        worldDisposed: assembledWorld.disposed,
        coreDestroyed: assembledCore.snapshot.destroyed,
        worldOwnedBodyCount: assembledWorld.ownedBodyCount,
      });
    },
  });
}

function defaultAdvance(
  matter: MatterLibrary,
): (engine: MatterJS.Engine, deltaMs: number) => void {
  return (engine, deltaMs) => matter.Engine.update(engine, deltaMs);
}

function clearOwnedEngine(
  matter: MatterLibrary,
  engine: MatterJS.Engine,
): void {
  matter.Engine.clear(engine);
  matter.Composite.clear(
    engine.world as unknown as MatterJS.CompositeType,
    false,
    true,
  );
}

function cleanupAssembly(
  matter: MatterLibrary,
  core: GrayboxCore | undefined,
  world: FirstLevelMatterWorld | undefined,
  engine: MatterJS.Engine | undefined,
  faultInjector:
    ((point: PrototypeLevelAssemblyFaultPoint) => void) | undefined,
): Readonly<{ errors: Error[]; engineCleared: boolean }> {
  const errors: Error[] = [];
  if (core) {
    try {
      faultInjector?.('cleanup-core');
      const result = core.destroy();
      if (result.status === 'blocked') {
        errors.push(new Error(result.message));
      }
    } catch (error) {
      errors.push(asError(error));
    }
  }
  if (world && !world.disposed) {
    try {
      faultInjector?.('cleanup-world');
      world.dispose();
    } catch (error) {
      errors.push(asError(error));
    }
  }
  let engineCleared = false;
  if (engine) {
    try {
      faultInjector?.('cleanup-engine');
      clearOwnedEngine(matter, engine);
      engineCleared = true;
    } catch (error) {
      errors.push(asError(error));
    }
  }
  return Object.freeze({ errors: Object.freeze(errors) as Error[], engineCleared });
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function asMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}
