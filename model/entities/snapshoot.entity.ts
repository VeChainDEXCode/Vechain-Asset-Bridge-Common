import { Column, Entity, Index, IsNull, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";

@Entity("snapshoot")
@Index(["chainname_0","chainid_0"])
@Index(["chainname_1","chainid_1"])
export class SnapshootEntity{

    @PrimaryColumn({name:"merkleroot",length:66})
    @Index()
    public merkleRoot!:string;

    @Column({name:"parent",length:66})
    @Index()
    public parent!:string;

    @Column({name:"chainname_0"})
    public chainName_0!:string;

    @Column({name:"chainid_0"})
    public chainId_0!:string;

    @Column({name:"begin_blocknum_0"})
    public beginBlockNum_0!:number;

    @Column({name:"end_blocknum_0"})
    public endBlockNum_0!:number;

    @Column({name:"chainname_1"})
    public chainName_1!:string;

    @Column({name:"chainid_1"})
    public chainId_1!:string;

    @Column({name:"begin_blocknum_1"})
    public beginBlockNum_1!:number;

    @Column({name:"end_blocknum_1"})
    public endBlockNum_1!:number;

    @Column({name:"valid"})
    public valid!:boolean;
}