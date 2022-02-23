import { Entity, PrimaryColumn, Column, Index } from "typeorm";
import { fixedBytes } from "../../utils/extensions/transformers";

@Entity(`bridgeTx`)
export class BridgeTxEntity{

    @PrimaryColumn({name:`bridgetxid`})
    public bridgeTxId!:string;

    @Index()
    @Column({name:`chainname`})
    public chainName!:string;

    @Index()
    @Column({name:`chainid`})
    public chainId!:string;

    @Index()
    @Column({name:`blocknum`,unsigned: true})
    public blockNum!:number;

    @Index()
    @Column({name:`blockid`})
    public blockId!:string;

    @Column({name:`txid`})
    public txid!:string;

    @Column({name:`index`,unsigned: true})
    public index!:number;

    @Index()
    @Column({name:`token`})
    public token!:string;

    @Column({name:`amount`})
    public amount!:string;

    @Column({name:`timestamp`,unsigned: true})
    public timestamp!:number;

    @Column({name:`recipient`})
    public recipient!:string;

    @Column({name:`type`,unsigned: true})
    public type!:1|2;

    @Column({name:`from`,nullable:true})
    public from!:string;

    @Column({name:`reward`,nullable:false})
    public reward!:string;

    @Column({name:`swapcount`,nullable:false})
    public swapCount!:string;
}