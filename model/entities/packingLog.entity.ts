import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity("packinglog")
export class PackingLogEntity{

    @PrimaryGeneratedColumn()
    public logid!:number;

    @Index()
    @Column({name:"merkleroot",length:66})
    public merkleRoot!:string;

    @Index()
    @Column({name:"bridgetxid"})
    public bridgetxid!:string;

    @Column({name:"valid"})
    public valid!:boolean;
}