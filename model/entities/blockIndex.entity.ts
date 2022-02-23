import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity(`blockindex`)
@Index([`chainName`,`chainId`])
export class BlockIndexEntity {
    
    @PrimaryColumn({name:`indexid`})
    public indexid!: string;

    @Column({name:`chainname`})
    public chainName!:string;

    @Column({name:`chainid`})
    public chainId!:string;

    @Column({name:`blockid`})
    @Index()
    public blockId!:string;

    @Column({name:`blocknum`,unsigned: true})
    @Index()
    public blockNum!:number;

    @Column({name:`timestamp`,unsigned: true})
    public timestamp!:number;
}