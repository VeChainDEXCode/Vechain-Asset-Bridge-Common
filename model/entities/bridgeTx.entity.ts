import { Entity, PrimaryColumn, Column, Index } from "typeorm";

@Entity("bridgeTx")
export class BridgeTxEntity{

    @PrimaryColumn({name:"bridgetxid"})
    public bridgeTxId!:string;

    @Index()
    @Column({name:"chainname"})
    public chainName!:string;

    @Index()
    @Column({name:"chainid"})
    public chainId!:string;

    @Index()
    @Column({name:"blocknumber"})
    public blockNumber!:number;

    @Index()
    @Column({name:"blockid"})
    public blockId!:string;

    @Column({name:"txid"})
    public txid!:string;

    @Column({name:"clauseindex"})
    public clauseIndex!:number;

    @Column({name:"index"})
    public index!:number;

    @Index()
    @Column({name:"token"})
    public token!:string;

    @Column({name:"amount"})
    public amount!:string;

    @Column({name:"timestamp"})
    public timestamp!:number;

    @Column({name:"recipient"})
    public recipient!:string;

    @Column({name:"type"})
    public type!:1|2;

    @Column({name:"swaptxhash"})
    @Index()
    public swapTxHash!:string;

    @Column({name:"from"})
    public from!:string;

    @Column({name:"reward"})
    public reward!:string;

    @Column({name:"swapcount"})
    public swapCount!:string;
}