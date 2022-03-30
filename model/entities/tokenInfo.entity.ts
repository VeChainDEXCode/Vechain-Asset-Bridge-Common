import { Entity, PrimaryColumn, Column } from "typeorm";
import { fixedBytes } from "../../utils/extensions/transformers";

@Entity("tokeInfo")
export class TokenEntity{

    @PrimaryColumn({name:"tokenid"})
    public tokenid!:string;

    @Column({name:"chainname"})
    public chainName!:string;

    @Column({name:"chainid"})
    public chainId!:string;

    @Column({name:"name"})
    public name!:string;

    @Column({name:"symbol"})
    public symbol!:string;

    @Column({name:"decimals",unsigned: true})
    public decimals!:number;

    @Column({name:"tokenAddr"})
    public tokenAddr!:string;

    @Column({name:"tokentype",unsigned: true})
    public tokenType!:number;

    @Column({name:'nativecoin'})
    public nativeCoin!:boolean;

    @Column({name:"targettokenaddr"})
    public targetTokenAddr!:string;

    @Column({name:"targetchainname"})
    public targetChainName!:string;

    @Column({name:"targetchainid"})
    public targetChainId!:string;

    @Column({name:"begin",unsigned: true})
    public begin!:number;

    @Column({name:'reward',unsigned:true})
    public reward!:number;

    @Column({name:"end",unsigned: true})
    public end!:number;

    @Column({name:"updateblocknum",unsigned: true})
    public updateBlockNum!:number;

    @Column({name:"updateblockid"})
    public updateBlockId!:string;
}