import { keccak256 } from "thor-devkit";

export enum BridgeTxType {
    swap = 1,
    claim = 2
}

export type BaseBridgeTx = {
    bridgeTxId:string;
    chainName:string;
    chainId:string;
    blockNumber:number;
    blockId:string;
    txid:string;
    index:number;
    token:string;
    amount:bigint;
    timestamp:number;
    recipient:string;
    type:BridgeTxType;
}

export type SwapBridgeTx = BaseBridgeTx & {
    swapTxHash:string;
    from:string;
    reward:bigint;
    amountOut:bigint;
    swapCount:bigint
}

export type ClaimBridgeTx = BaseBridgeTx

export function swapTxHash(tx:SwapBridgeTx):string {
    let buff = Buffer.concat([
        Buffer.from(tx.chainName),
        Buffer.from(tx.chainId),
        Buffer.from(tx.recipient.substring(2),'hex'),
        Buffer.from(tx.token.substring(2),'hex'),
        Buffer.from((tx.amount - tx.reward).toString(16).padStart(64,'0'),'hex'),
        Buffer.from(tx.swapCount.toString(16).padStart(64,'0'),'hex'),
    ]);
    return '0x' + keccak256(buff).toString('hex');
}

export function bridgeTxId(tx:BaseBridgeTx):string {
    let buff = Buffer.concat([
        Buffer.from(tx.chainName),
        Buffer.from(tx.chainId),
        Buffer.from(tx.blockId.substring(2),'hex'),
        Buffer.from(tx.txid.substring(2),'hex'),
        Buffer.from(BigInt(tx.index).toString(16),'hex'),
    ]);
    return '0x' + keccak256(buff).toString('hex');
}