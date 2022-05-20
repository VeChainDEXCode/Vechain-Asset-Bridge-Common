import { keccak256 } from "thor-devkit";

export type TokenInfo = {
    tokenid:string;
    chainName:string;
    chainId:string;
    name:string;
    symbol:string;
    decimals:number,
    tokenAddr:string;
    nativeCoin:boolean,
    tokenType:number;
    targetTokenAddr:string,
    targetChainName:string,
    targetChainId:string,
    begin:number;
    end:number;
    reward:number;
    updateBlockNum:number;
    updateBlockId:string;
}

export function tokenid(chainName:string,chainId:string,address:string):string{
    let encode = Buffer.concat([
        Buffer.from(chainName.toLowerCase()),
        Buffer.from(chainId.toLowerCase()),
        Buffer.from(address.toLowerCase())
    ]); 
    return '0x' + keccak256(encode).toString('hex');
}