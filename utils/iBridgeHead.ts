import { ActionData } from "./components/actionResult";
import { BridgeSnapshoot } from "./types/bridgeSnapshoot";
import { BaseBridgeTx } from "./types/bridgeTx";

export interface IBridgeHead {
    getLastSnapshoot():Promise<ActionData<{sn:BridgeSnapshoot,txid:string,blocknum:number}>>;
    getSnapshoot(begin:number,end:number):Promise<ActionData<BridgeSnapshoot[]>>;
    getMerkleRoot():Promise<ActionData<string>>;
    scanTxs(begin:number,end:number):Promise<ActionData<BaseBridgeTx[]>>;
}