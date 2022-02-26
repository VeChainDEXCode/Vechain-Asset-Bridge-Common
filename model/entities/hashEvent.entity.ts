import { Column, Entity, Index, IsNull, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";

@Entity('hashevent')
@Index(['chainName','chainId','hash'])
export class HashEventEntity{

    @PrimaryColumn({name:'eventid'})
    public eventId!:string;

    @Column({name:'chainname'})
    public chainName!:string;

    @Column({name:'chainid'})
    public chainId!:string;

    @Column({name:'blocknumber',unsigned: true})
    public blockNumber!:number;

    @Column({name:'blockid'})
    public blockId!:string;

    @Column({name:'txid'})
    public txid!:string;

    @Column({name:'index',unsigned: true})
    public index!:number;

    @Column({name:'timestamp',unsigned: true})
    public timestamp!:number;

    @Column({name:'appid'})
    @Index()
    public appid!:string;

    @Column({name:'sender'})
    public sender!:string;

    @Column({name:'hash'})
    @Index()
    public hash!:string;
}