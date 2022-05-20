import { HashEvent } from "./hashEvent";

export type BridgeSnapshoot = {
    merkleRoot:string;
    chains:Array<ChainInfo>;
}

export type ChainInfo = {
    chainName:string;
    chainId:string;
    beginBlockNum:number;
    endBlockNum:number;
}

export function ZeroRoot():string{
    return "0x0000000000000000000000000000000000000000000000000000000000000000";
}