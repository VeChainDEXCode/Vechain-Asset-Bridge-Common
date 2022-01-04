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

    @Column({name:"tokenaddr"})
    public tokenAddr!:string;

    @Column({name:"tokentype",unsigned: true})
    public tokenType!:number;

    @Column({name:"targettoken"})
    public targetToken!:string;

    @Column({name:"begin",unsigned: true})
    public begin!:number;

    @Column({name:"end",unsigned: true})
    public end!:number;

    @Column({name:"update",unsigned: true})
    public update!:number;

    @Column({name:"updateblock"})
    public updateBlock!:string;

    @Column({name:"valid",type:"boolean",default:true})
    public valid!:boolean;
}