import { Column, Entity, Index, IsNull, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { fixedBytes } from "../../utils/extensions/transformers";

@Entity("snapshoot")
@Index(["chainName_0","chainId_0"])
@Index(["chainName_1","chainId_1"])
export class SnapshootEntity{

    @PrimaryColumn({name:"merkleroot"})
    @Index()
    public merkleRoot!:string;

    @Column({name:"chainname_0"})
    public chainName_0!:string;

    @Column({name:"chainid_0"})
    public chainId_0!:string;

    @Column({name:"begin_blocknum_0",unsigned: true})
    public beginBlockNum_0!:number;

    @Column({name:"end_blocknum_0",unsigned: true})
    public endBlockNum_0!:number;

    @Column({name:"chainname_1"})
    public chainName_1!:string;

    @Column({name:"chainid_1"})
    public chainId_1!:string;

    @Column({name:"begin_blocknum_1",unsigned: true})
    public beginBlockNum_1!:number;

    @Column({name:"end_blocknum_1",unsigned: true})
    public endBlockNum_1!:number;
}