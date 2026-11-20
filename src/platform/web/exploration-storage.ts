import { validateExplorationSave, migrateExp02ASave, migrateExp02BSave, migrateExp02CSave, emptyExplorationSave, type ExplorationSave } from '../../core/exploration.ts';
export const EXP_STORAGE_KEY = 'pokan.exp03b.save.v1';
export const EXP_02C_STORAGE_KEY = 'pokan.exp02c.save.v1';
export const EXP_02B_STORAGE_KEY = 'pokan.exp02b.save.v1';
export const EXP_PREVIOUS_STORAGE_KEY = 'pokan.exp02a.save.v1';
export const EXP_LEGACY_STORAGE_KEY = 'pokan.exp01.save.v1';
export interface ExplorationStoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export class ExplorationStorage {
  #blocked = false;
  status = '尚未保存';
  notice = '';
  readonly port: ExplorationStoragePort;
  constructor(port: ExplorationStoragePort) { this.port=port; }
  load(): ExplorationSave | undefined {
    try {
      const raw = this.port.getItem(EXP_STORAGE_KEY);
      if (raw === null) {
        const previousCity=this.port.getItem(EXP_02C_STORAGE_KEY);
        if(previousCity!==null){
          const migrated=migrateExp02CSave(JSON.parse(previousCity));
          if(!migrated){this.#blocked=true;this.status='上版旅程档案未通过校验，本次未保存；原档保留';return;}
          this.notice='已沿用旅程进度与原有纪念卡；新增纪念物尚未收集，旧档案保留。';this.status='已读取上版旅程';return migrated;
        }
        const lastVersion=this.port.getItem(EXP_02B_STORAGE_KEY);
        if(lastVersion!==null){
          const migrated=migrateExp02BSave(JSON.parse(lastVersion));
          if(!migrated){this.#blocked=true;this.status='上版街区档案未通过校验，本次未保存；原档保留';return;}
          this.notice='已沿用街区进度与原有纪念卡状态；旧档案保留。';this.status='已读取上版街区进度';return migrated;
        }
        const previous=this.port.getItem(EXP_PREVIOUS_STORAGE_KEY);
        if(previous!==null){
          const migrated=migrateExp02ASave(JSON.parse(previous));
          if(!migrated){this.#blocked=true;this.status='旧街区档案未通过校验，本次未保存；原档保留';return;}
          this.notice='已沿用街区进度，拍摄尚未完成；旧档案保留。';this.status='已读取旧街区进度';return migrated;
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
    try {
      this.port.setItem(EXP_STORAGE_KEY,JSON.stringify(emptyExplorationSave()));
      this.#blocked = false; this.status = '已开始新旅程'; return true;
    } catch { this.status = '无法写入新局，本次未重新开始'; return false; }
  }
}
