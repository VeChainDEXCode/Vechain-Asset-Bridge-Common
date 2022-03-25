import Web3 from "web3";
import { Contract,EventData } from "web3-eth-contract";
import { IBridgeCore } from "../utils/iBridgeCore";
import { ActionData } from "../utils/components/actionResult";
import { BridgeSnapshoot, ZeroRoot } from "../utils/types/bridgeSnapshoot";
import { HashEvent } from "../utils/types/hashEvent";
import { RLP } from "thor-devkit";
import Web3Eth from 'web3-eth';

export class EthereumBridgeCore implements IBridgeCore {

    constructor(env:any){
        this.env = env;
        this.web3 = env.web3;
        this.config = env.config;
        this.initBridgeCore();
    }

    public async getLastSnapshoot(): Promise<ActionData<{ sn: BridgeSnapshoot; txid: string; blocknum: number}>> {
        let result = new ActionData<{ sn: BridgeSnapshoot; txid: string; blocknum: number}>();

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
            const begin = this.config.ethereum.startBlockNum;
            const end = await this.web3.eth.getBlockNumber();

            for(let blockNum = end;blockNum >= begin;){
                let from = blockNum - this.scanBlockStep >= begin ? blockNum - this.scanBlockStep : begin;
                let to = blockNum;

                const events = await this.bridgeCore.getPastEvents('UpdateMerkleRoot',{fromBlock:from,toBlock:to});
                if(events.length == 0){
                    blockNum = from - 1;
                    continue;
                }
                const ev = events[events.length - 1];
                sn = this.convertToSN(ev);
                txid = ev.transactionHash;
                blocknum = ev.blockNumber;
                break;
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

        try {
            for(let blockNum = end;blockNum >= begin;){
                let from = blockNum - this.scanBlockStep >= begin ? blockNum - this.scanBlockStep : begin;
                let to = blockNum;
                const events = await this.bridgeCore.getPastEvents('UpdateMerkleRoot',{fromBlock:from,toBlock:to});
                for(const ev of events){
                    const sn = this.convertToSN(ev);
                    result.data.push(sn);
                }
                blockNum = to - 1;
            }
        } catch (error) {
            result.error = error;
        }
        return result;
    }
    
    public async getRootCount(): Promise<ActionData<number>> {
        let result = new ActionData<number>();
        try {
            const data = await this.bridgeCore.methods.rootCount().call();
            result.data = Number(data);
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async getSubmitEventsByRange(begin: number, end: number): Promise<ActionData<HashEvent[]>> {
        let result = new ActionData<HashEvent[]>();
        result.data = new Array();
        let blockCache:Map<number,Web3Eth.BlockTransactionString> = new Map();

        try {
            for(let block = begin; block <= end;){
                let from = block;
                let to = block + this.scanBlockStep > end ? end:block + this.scanBlockStep;

                console.debug(`scan ethereum submithash blocknum: ${from} - ${to}`);

                const events = await this.bridgeCore.getPastEvents('SubmitHashEvent',{fromBlock:from,toBlock:to});
                for(const ev of events){
                    if(!blockCache.has(ev.blockNumber)){
                        const block = await this.web3.eth.getBlock(ev.blockNumber);
                        blockCache.set(block.number,block);
                    }
                    const submithash:HashEvent = {
                        chainName:this.config.vechain.chainName,
                        chainId:this.config.vechain.chainId,
                        blockNumber:ev.blockNumber,
                        blockId:ev.blockHash,
                        txid:ev.transactionHash,
                        index:ev.logIndex,
                        timestamp:blockCache.get(ev.blockNumber)!.timestamp as number,
                        appid:ev.returnValues['_appid'] as string,
                        sender:ev.returnValues['_sender'] as string,
                        hash:ev.returnValues['_value'] as string
                    }
                    result.data.push(submithash);
                }
                block = to + 1;
            }
        } catch (error) {
            result.error = error;
        }

        return result;
    }
    
    public async getSnapshootByIndex(index: number): Promise<ActionData<BridgeSnapshoot>> {
        let result = new ActionData<BridgeSnapshoot>();
        result.data = {merkleRoot:ZeroRoot(),chains:[]};

        //Handle GenesisSnapshoot
        if(index == 0){
            result.data = this.env.genesisSnapshoot;
            return result;
        }

        try {
            const root = await this.bridgeCore.methods.rootList(index).call();
            if(root != ZeroRoot()){
                const infoDecode = await this.bridgeCore.methods.rootInfo(root).call();
                const rlpDecode = this.argsRLP.decode(infoDecode.args);
                result.data = {
                    merkleRoot:root,
                    chains:[
                        {
                            chainName:this.config.vechain.chainName,
                            chainId:this.config.vechain.chainId,
                            beginBlockNum:rlpDecode.vbegin as number,
                            endBlockNum:rlpDecode.vend as number
                        },
                        {
                            chainName:this.config.ethereum.chainName,
                            chainId:this.config.ethereum.chainId,
                            beginBlockNum:rlpDecode.ebegin as number,
                            endBlockNum:rlpDecode.eend as number
                        }
                ]}
            }

        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async getSnapshootByRoot(root:string):Promise<ActionData<{sn:BridgeSnapshoot,index:number}>> {
        let result = new ActionData<{sn:BridgeSnapshoot,index:number}>();
        result.data = {sn:{merkleRoot:ZeroRoot(),chains:[]},index:0};

        //Handle GenesisSnapshoot
        if(root == (this.env.genesisSnapshoot as BridgeSnapshoot).merkleRoot){
            result.data = {sn:this.env.genesisSnapshoot,index:0};
            return result;
        }

        try {
            const infoDecode = await this.bridgeCore.methods.rootInfo(root).call();
            if(infoDecode.index != 0){
                const rlpDecode = this.argsRLP.decode(infoDecode.args);
                result.data = {
                    index:infoDecode.index as number,
                    sn:{
                        merkleRoot:root,
                        chains:[
                            {
                                chainName:this.config.vechain.chainName,
                                chainId:this.config.vechain.chainId,
                                beginBlockNum:rlpDecode.vbegin as number,
                                endBlockNum:rlpDecode.vend as number
                            },
                            {
                                chainName:this.config.ethereum.chainName,
                                chainId:this.config.ethereum.chainId,
                                beginBlockNum:rlpDecode.ebegin as number,
                                endBlockNum:rlpDecode.eend as number
                            }
                    ]}
                }
            }
        } catch (error) {
            result.error = error;
        }

        return result;
    }
    
    public async getInfoByRoot(root: string): Promise<ActionData<{ root: string; index: number; args: any; }>> {
        let result = new ActionData<{ root: string; index: number; args: any; }>();
        result.data = {root:ZeroRoot(),index:0,args:{}};
        try {
            const infoDecode = await this.bridgeCore.methods.rootInfo(root).call();
            if(infoDecode.index != 0){
                const rlpDecode = this.argsRLP.decode(infoDecode.args);
                result.data = {root:root,index:infoDecode.index,args:rlpDecode};
            }
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    private initBridgeCore() {
        this.bridgeCore = this.env.contracts.ethereum.bridgeCore;
    }

    private convertToSN(event:EventData):BridgeSnapshoot {
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
        const rlpDecode = this.argsRLP.decode(event.returnValues['_args']);
        sn.merkleRoot = event.returnValues['_root'] as string;
        sn.chains[0].beginBlockNum = rlpDecode.vbegin as number;
        sn.chains[0].endBlockNum = rlpDecode.vend as number;
        sn.chains[1].beginBlockNum = rlpDecode.ebegin as number;
        sn.chains[1].endBlockNum = rlpDecode.eend as number;
        return sn;
    }

    private env:any;
    private config:any;
    private web3!:Web3;
    private bridgeCore!:Contract;
    private readonly scanBlockStep = 200;
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