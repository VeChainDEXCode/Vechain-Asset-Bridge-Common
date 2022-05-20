import { Framework } from "@vechain/connex-framework";
import { IBridgeCore } from "../utils/iBridgeCore";
import { ActionData } from "../utils/components/actionResult";
import { BridgeSnapshoot, ZeroRoot } from "../utils/types/bridgeSnapshoot";
import { Contract } from "myvetools";
import { HashEvent } from "../utils/types/hashEvent";
import { abi, RLP } from "thor-devkit";
import { getAllEvents } from "./vechainCommon";

export class VeChainBridgeCore implements IBridgeCore {

    constructor(env:any){
        this.env = env;
        this.connex = env.connex;
        this.config = env.config;
        this.initBridgeCore();
    }

    public async getLastSnapshoot(): Promise<ActionData<{ sn: BridgeSnapshoot; txid: string; blocknum: number; }>> {
        let result = new ActionData<{ sn: BridgeSnapshoot; txid: string; blocknum: number; }>();

        const filter = this.connex.thor.filter('event',[{
            address:this.config.vechain.contracts.bridgeCore,
            topic0:this.updateMerkleRootEvent.signature
        }]).order('desc');

        let sn:BridgeSnapshoot = {
            merkleRoot:ZeroRoot(),
            chains:[{
                chainName:this.config.vechain.chainName,
                chainId:this.config.vechain.chainId,
                beginBlockNum:this.config.vechain.startBlockNum,
                endBlockNum:this.config.vechain.startBlockNum
            },{
                chainName:this.config.ethereum.chainName,
                chainId:this.config.ethereum.chainId,
                beginBlockNum:this.config.ethereum.startBlockNum,
                endBlockNum:this.config.ethereum.startBlockNum
            }]
        }

        let txid:string = "";
        let blocknum:number = 0;

        try {
            let begin = this.config.vechain.startBlockNum;
            let end = (await this.connex.thor.block().get())!.number;

            for(let bNum = end;bNum >= begin;){
                let from = bNum - this.scanBlockStep >= begin ? bNum - this.scanBlockStep + 1: begin;
                let to = bNum;
                const events = await filter.range({unit:"block",from:from,to:to}).apply(0,1);
                if(events.length == 1){
                    sn = this.convertToSN(events[0]);
                    txid = events[0].meta.txID;
                    blocknum = events[0].meta.blockNumber;
                    break;
                } else {
                    bNum = from;
                    continue;
                }
            }

            //Handle GenesisSnapshoot
            if(sn.merkleRoot == (this.env.genesisSnapshoot as BridgeSnapshoot).merkleRoot){
                result.data = {sn:this.env.genesisSnapshoot,txid:txid,blocknum:blocknum};
                return result;
            }

            result.data = {sn:sn,txid:txid,blocknum:blocknum};   
        } catch (error) {
            result.error = error;
        }
        return result;
    }
    
    public async getSnapshootByRange(begin: number, end: number): Promise<ActionData<BridgeSnapshoot[]>> {
        let result = new ActionData<BridgeSnapshoot[]>();
        result.data = new Array();

        for(let blockNum = end;blockNum >= begin;){
            let from = blockNum - this.scanBlockStep >= begin ? blockNum - this.scanBlockStep + 1 : begin;
            let to = blockNum;

            const filter = this.connex.thor.filter('event',[{
                address:this.config.vechain.contracts.bridgeCore,
                topic0:this.updateMerkleRootEvent.signature
            }]).order('desc').range({unit:'block',from:from,to:to});

            const events = await getAllEvents(filter);
            for(const ev of events){
                const sn = this.convertToSN(ev);
                result.data.push(sn);
            }
            blockNum = from;
        }
        return result;
    }

    public async getRootCount(): Promise<ActionData<number>> {
        let result = new ActionData<number>();
        result.data = 0;

        try {
            const call = await this.bridgeCore.call('rootCount');
            result.data = Number(call.decoded[0]);
        } catch (error) {
            result.error = error;
        }

        return result;
    }
    
    public async getSubmitEventsByRange(begin: number, end: number): Promise<ActionData<HashEvent[]>> {
        let result = new ActionData<HashEvent[]>();
        result.data = new Array();

        for(let blockNum = begin;blockNum <= end;){
            let from = blockNum;
            let to = blockNum + this.scanBlockStep > end ? end:blockNum + this.scanBlockStep;

            console.debug(`scan vechain submithash blocknum: ${from} - ${to}`);

            const filter = this.connex.thor.filter('event',[{
                address:this.config.vechain.contracts.bridgeCore,
                topic0:this.submitHashEvent.signature
            }]).order('asc').range({unit:'block',from:from,to:to});
            
            const events = await getAllEvents(filter);

            let evIndex = 0;
            let blockid = "";

            for(const ev of events){
                if(blockid != ev.meta.blockID){
                    blockid = ev.meta.blockID;
                    evIndex = 0;
                }
                const evDecode = this.submitHashEvent.decode(ev.data,ev.topics);
                const hashevent:HashEvent = {
                    chainName:this.config.vechain.chainName,
                    chainId:this.config.vechain.chainId,
                    blockNumber:ev.meta.blockNumber,
                    blockId:ev.meta.blockID,
                    txid:ev.meta.txID,
                    index:evIndex,
                    timestamp:ev.meta.blockTimestamp,
                    appid:String(evDecode[0]),
                    sender:String(evDecode[1]),
                    hash:String(evDecode[2])
                }
                result.data.push(hashevent);
                evIndex++;
            }

            blockNum = to + 1;
        }
        return result;
    }

    public async getSnapshootByIndex(index: number):Promise<ActionData<BridgeSnapshoot>>{
        let result = new ActionData<BridgeSnapshoot>();
        result.data = {merkleRoot:ZeroRoot(),chains:[]};

        //Handle GenesisSnapshoot
        if(index == 0){
            result.data = this.env.genesisSnapshoot;
            return result;
        }

        try {
            const root = (await this.bridgeCore.call('rootList',index)).decoded[0];
            if(root != null && root != ZeroRoot()){
                const infoDecode = (await this.bridgeCore.call('rootInfo',root));
                const rlpDecode = this.argsRLP.decode(infoDecode.decoded[1]);
                result.data = {merkleRoot:root,chains:[
                    {
                        chainName:this.config.vechain.chainName,
                        chainId:this.config.vechain.chainId,
                        beginBlockNum:Number(rlpDecode.vbegin),
                        endBlockNum:Number(rlpDecode.vend)
                    },
                    {
                        chainName:this.config.ethereum.chainName,
                        chainId:this.config.ethereum.chainId,
                        beginBlockNum:Number(rlpDecode.ebegin),
                        endBlockNum:Number(rlpDecode.eend)
                    }]}
            }
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async getSnapshootByRoot(root:string):Promise<ActionData<{sn:BridgeSnapshoot,index:number}>>{
        let result = new ActionData<{sn:BridgeSnapshoot,index:number}>();
        result.data = {sn:{merkleRoot:ZeroRoot(),chains:[]},index:0};

        //Handle GenesisSnapshoot
        if(root == (this.env.genesisSnapshoot as BridgeSnapshoot).merkleRoot){
            result.data = {sn:this.env.genesisSnapshoot,index:0};
            return result;
        }

        try {
            const infoDecode = (await this.bridgeCore.call('rootInfo',root));
            if(infoDecode.decoded[0] != 0){
                const rlpDecode = this.argsRLP.decode(infoDecode.decoded[1]);
                result.data.index = Number(infoDecode.decoded[0]);
                result.data.sn = {merkleRoot:root,chains:[
                    {
                        chainName:this.config.vechain.chainName,
                        chainId:this.config.vechain.chainId,
                        beginBlockNum:Number(rlpDecode.vbegin),
                        endBlockNum:Number(rlpDecode.vend)
                    },
                    {
                        chainName:this.config.ethereum.chainName,
                        chainId:this.config.ethereum.chainId,
                        beginBlockNum:Number(rlpDecode.ebegin),
                        endBlockNum:Number(rlpDecode.eend)
                    }]}
            }
        } catch (error) {
            result.error = error;
        }
        return result;
    }


    private initBridgeCore() {
        this.bridgeCore = this.env.contracts.vechain.bridgeCore;
        this.updateMerkleRootEvent = new abi.Event(this.bridgeCore.ABI('UpdateMerkleRoot','event') as any);
        this.submitHashEvent = new abi.Event(this.bridgeCore.ABI('SubmitHashEvent','event') as any);
    }

    private convertToSN(event:any):BridgeSnapshoot {
        let sn:BridgeSnapshoot = {
            merkleRoot:ZeroRoot(),
            chains:[{
                chainName:this.config.vechain.chainName,
                chainId:this.config.vechain.chainId,
                beginBlockNum:this.config.vechain.startBlockNum,
                endBlockNum:this.config.vechain.startBlockNum
            },{
                chainName:this.config.ethereum.chainName,
                chainId:this.config.ethereum.chainId,
                beginBlockNum:this.config.ethereum.startBlockNum,
                endBlockNum:this.config.ethereum.startBlockNum
            }]
        }

        const decode = this.updateMerkleRootEvent.decode(event.data,event.topics);
        const rlpDecode =  this.argsRLP.decode(decode[1]);
        sn.merkleRoot = String(decode[0]);
        sn.chains[0].beginBlockNum = Number(rlpDecode.vbegin);
        sn.chains[0].endBlockNum = Number(rlpDecode.vend);
        sn.chains[1].beginBlockNum = Number(rlpDecode.ebegin);
        sn.chains[1].endBlockNum = Number(rlpDecode.eend);
        return sn;
    }

    private env:any;
    private config:any;
    private connex!:Framework;
    private readonly scanBlockStep = 500;
    private bridgeCore!:Contract;
    private updateMerkleRootEvent!:abi.Event;
    private submitHashEvent!:abi.Event;
    private readonly argsRLP = new RLP({
        name:'range',
        kind:[
            {name:'vbegin',kind:new RLP.NumericKind(32)},
            {name:'vend',kind:new RLP.NumericKind(32)},
            {name:'ebegin',kind:new RLP.NumericKind(32)},
            {name:'eend',kind:new RLP.NumericKind(32)},
        ]
    });
}