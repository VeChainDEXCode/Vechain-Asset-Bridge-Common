import { ActionData } from "./components/actionResult";
import { BridgeSnapshoot } from "./types/bridgeSnapshoot";
import { HashEvent } from "./types/hashEvent";

export interface IBridgeCore {
    getLastSnapshoot():Promise<ActionData<{sn:BridgeSnapshoot,txid:string,blocknum:number}>>;
    getSnapshootByRange(begin:number,end:number):Promise<ActionData<BridgeSnapshoot[]>>;
    getRootCount():Promise<ActionData<number>>;
    getSubmitEventsByRange(begin:number,end:number):Promise<ActionData<HashEvent[]>>;
    getMerkleRootByIndex(index:number):Promise<ActionData<{root:string,args:any}>>;
    getInfoByRoot(root:string):Promise<ActionData<{root: string; index:number,args: any}>>;
}