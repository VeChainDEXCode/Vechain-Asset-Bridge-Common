import { keccak256 } from "thor-devkit";

export type HashEvent = {
    chainName:string;
    chainId:string;
    blockNumber:number;
    blockId:string;
    txid:string;
    index:number;
    timestamp:number;
    appid:string;
    sender:string;
    hash:string;
}

export function hashEventId(ev:HashEvent):string {
    let encode = Buffer.concat([
        Buffer.from(ev.chainName.toLowerCase()),
        Buffer.from(ev.chainId.toLowerCase()),
        Buffer.from(ev.appid.toLowerCase()),
        Buffer.from(ev.hash.toLowerCase())
    ]); 
    return '0x' + keccak256(encode).toString('hex');
}