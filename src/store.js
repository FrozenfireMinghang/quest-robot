import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export class Store {
  constructor(path=process.env.QUEST_DATA_FILE||'data/games.json') {
    this.path=resolve(path); this.games=existsSync(this.path)?JSON.parse(readFileSync(this.path,'utf8')):{};
  }
  get(key) { return this.games[key]; }
  // Clone before mutation: invalid actions and failed disk writes cannot partially change a game.
  update(key,fn) {
    const draft=structuredClone(this.games[key]); const result=fn(draft);
    const game=result?.game||draft; if(game) game.revision=(game.revision||0)+1;
    const games={...this.games,[key]:game};
    mkdirSync(dirname(this.path),{recursive:true,mode:0o700});
    writeFileSync(this.path+'.tmp',JSON.stringify(games),{mode:0o600}); renameSync(this.path+'.tmp',this.path);
    this.games=games; return {game,value:result?.value};
  }
}
