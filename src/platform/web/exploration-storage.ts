import { validateExplorationSave, migrateExp02ASave, migrateExp02BSave, migrateExp02CSave, migrateExp03BSave, migrateExp05ASave, migrateExp05BSave, emptyExplorationSave, type ExplorationSave } from '../../core/exploration.ts';
export const EXP_STORAGE_KEY = 'pokan.exp06a.save.v1';
export const EXP_05B_STORAGE_KEY = 'pokan.exp05b.save.v1';
export const EXP_05A_STORAGE_KEY = 'pokan.exp05a.save.v1';
export const EXP_03B_STORAGE_KEY = 'pokan.exp03b.save.v1';
export const EXP_02C_STORAGE_KEY = 'pokan.exp02c.save.v1';
export const EXP_02B_STORAGE_KEY = 'pokan.exp02b.save.v1';
export const EXP_PREVIOUS_STORAGE_KEY = 'pokan.exp02a.save.v1';
export const EXP_LEGACY_STORAGE_KEY = 'pokan.exp01.save.v1';
export interface ExplorationStoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export class ExplorationStorage {
  #blocked = false;
  status = '尚未保存';
  restartError = '';
  notice = '';
  readonly port: ExplorationStoragePort;
  constructor(port: ExplorationStoragePort) { this.port=port; }
  load(): ExplorationSave | undefined {
    try {
      const raw = this.port.getItem(EXP_STORAGE_KEY);
      if (raw === null) {
        // Ordered finite migration chain. A present invalid newer record blocks
        // fallback; no old key is ever rewritten or removed.
        for(const [key,convert] of [
          [EXP_05B_STORAGE_KEY,migrateExp05BSave],[EXP_05A_STORAGE_KEY,migrateExp05ASave],
          [EXP_03B_STORAGE_KEY,migrateExp03BSave],[EXP_02C_STORAGE_KEY,migrateExp02CSave],
          [EXP_02B_STORAGE_KEY,migrateExp02BSave],[EXP_PREVIOUS_STORAGE_KEY,migrateExp02ASave],
        ] as const){
          const previous=this.port.getItem(key);if(previous===null)continue;
          const original=JSON.parse(previous),migrated=convert(original);
          if(!migrated){this.#blocked=true;this.status='上版档案未通过校验，本次未保存；原档保留';return;}
          this.notice='已沿用街区进度、照片与纪念物；原档案保留，位置已对应新版街面。';
          if((original.safe==='teaDoor'||original.safe==='teaRoom')&&migrated.safe!==original.safe&&['cGuideH2','cGuide1Door'].includes(migrated.safe))this.notice+=' 原茶歇现位于尚未开放的下街，已移至中街导览接待处，未补开通路。';
          this.status='已读取上版旅程档案';return migrated;
        }
        if(this.port.getItem(EXP_LEGACY_STORAGE_KEY)!==null)this.notice='已开始新街区；旧庭院小样档案保留，不自动继承通关。';
        return;
      }
      const save = validateExplorationSave(JSON.parse(raw));
      if (!save) throw new Error('Invalid save');
      this.status = '已读取本地记录';
      return save;
    } catch {
      this.#blocked = true;
      this.status = '本地记录不可读取，本次未保存；原记录保留';
      return;
    }
  }
  save(save: ExplorationSave): void {
    if (this.#blocked) return;
    try {
      if (!validateExplorationSave(save)) throw new Error('Invalid outgoing save');
      this.port.setItem(EXP_STORAGE_KEY, JSON.stringify(save));
      this.status = '已自动保存';
    } catch { this.status = '本次未保存，仍可继续游玩'; }
  }
  restart(): boolean {
    this.restartError = '';
    try {
      this.port.setItem(EXP_STORAGE_KEY,JSON.stringify(emptyExplorationSave()));
      this.#blocked = false; this.status = '已开始新旅程'; return true;
    } catch { this.restartError = '无法写入新局，本次未重新开始'; return false; }
  }
}
