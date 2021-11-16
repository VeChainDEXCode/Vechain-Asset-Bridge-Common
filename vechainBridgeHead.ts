import { string } from "@oclif/parser/lib/flags";
import { Framework } from "@vechain/connex-framework";
import Axios from "axios";
import { Contract } from "myvetools";
import { compileContract } from "myvetools/dist/utils";
import path from "path";
import { abi } from "thor-devkit";
import { ActionData } from "./utils/components/actionResult";
import { ThorDevKitEx } from "./utils/extensions/thorDevkitExten";
import { IBridgeHead } from "./utils/iBridgeHead";
import { BridgeSnapshoot, ZeroRoot } from "./utils/types/bridgeSnapshoot";
import { BridgeTx } from "./utils/types/bridgeTx";
import { tokenid, TokenInfo } from "./utils/types/tokenInfo";
import { VIP180Token } from "./vip180Token";
export class VeChainBridgeHead implements IBridgeHead {

    constructor(env:any){
        this.env = env;
        this.connex = this.env.connex;
        this.config = this.env.config;
        this.initV2EBridge();
    }

    public async getSnapshoot(begin:number,end:number):Promise<ActionData<BridgeSnapshoot[]>>{
        let result = new ActionData<BridgeSnapshoot[]>();
        result.data = new Array();

        const upEventResult = await this.updateMerkleRootEvents(begin,end);
        if(upEventResult.error != undefined){
            result.copyBase(upEventResult);
            return result;
        }
        let upEvents = upEventResult.data!;
        let lockEvents = new Array<{blockNum:number,root:string,status:boolean}>();

        if(upEvents.length>0){
            const lockEventsResult = await this.lockChangeEvents(upEvents[0].from,end);
            if(lockEventsResult.error != undefined){
                result.copyBase(lockEventsResult);
                return result;
            }
            lockEvents = lockEventsResult.data!;
        }

        for(const upEvent of upEvents){
            const targetLockEvent = lockEvents.filter( event => {return event.root == upEvent.parentRoot && event.status == true && event.blockNum != upEvent.blockNum;})
                .sort((a,b) => {return b.blockNum - a.blockNum;});
            if(targetLockEvent.length == 0){
                result.error = new Error(`can't get LockChange Event of ${upEvent.parentRoot}`);
            }

            let sn:BridgeSnapshoot = {
                parentMerkleRoot:upEvent.parentRoot,
                merkleRoot:upEvent.root,
                chains:[{
                    chainName:this.config.vechain.chainName,
                    chainId:this.config.vechain.chainId,
                    lockedBlockNum:targetLockEvent[0].blockNum,
                    beginBlockNum:upEvent.from,
                    endBlockNum:upEvent.blockNum
                }]
            }
            result.data.push(sn);
        }

        return result;
    }

    public async getLastSnapshoot():Promise<ActionData<{sn:BridgeSnapshoot,txid:string,blocknum:number}>>{
        let result = new ActionData<{sn:BridgeSnapshoot,txid:string,blocknum:number}>();

        let filter = this.connex.thor.filter("event",[{
            address:this.config.vechain.contracts.v2eBridge,
            topic0:this.UpdateMerkleRootEvent.signature
        }]).order("desc");

        let snapShoot:BridgeSnapshoot = {
            parentMerkleRoot:ZeroRoot(),
            merkleRoot:ZeroRoot(),
            chains:[
                {
                    chainName:this.config.vechain.chainName,
                    chainId:this.config.vechain.chainId,
                    lockedBlockNum:this.config.vechain.startBlockNum,
                    beginBlockNum:this.config.vechain.startBlockNum,
                    endBlockNum:this.config.vechain.startBlockNum
                }
            ]
        };
        let txid:string = "";
        let blocknum:number = 0;

        let begin = this.config.vechain.startBlockNum;
        let end = (await this.connex.thor.block().get())!.number;

        for(let blockNum = end;blockNum >= begin;){
            let from = blockNum - this.scanBlockStep >= begin ? blockNum - this.scanBlockStep : begin;
            let to = blockNum;
            const events = await filter.range({unit:"block",from:from,to:to}).apply(0,1);
            if(events.length == 1){
                let ev = events[0];
                snapShoot.merkleRoot = ev.topics[1];
                snapShoot.parentMerkleRoot = ev.topics[3];
                snapShoot.chains[0].beginBlockNum = parseInt(ev.topics[2],16);
                snapShoot.chains[0].endBlockNum = ev.meta.blockNumber;

                const lockevsResult = await this.lockChangeEvents(snapShoot.chains[0].beginBlockNum,snapShoot.chains[0].endBlockNum);
                if(lockevsResult.error != undefined){
                    result.copyBase(lockevsResult);
                    return result;
                }

                const lockevs = lockevsResult.data!.filter(ev =>{return ev.root == snapShoot.parentMerkleRoot && ev.status == true; });
                if(lockevs == undefined || lockevs.length == 0){
                    result.error = new Error(`can't found lockchange event, root:${snapShoot.parentMerkleRoot}`);
                    return result;
                }
                snapShoot.chains[0].lockedBlockNum = lockevs[0].blockNum;
                txid = ev.meta.txID;
                blocknum = ev.meta.blockNumber;
                break;
            } else {
                blockNum = from - 1;
                continue;
            }
        }
        result.data = {sn:snapShoot,txid:txid,blocknum:blocknum};
        return result;
    }

    public async getSnapshootByBlock(block:number):Promise<ActionData<BridgeSnapshoot>>{
        let result = new ActionData<BridgeSnapshoot>();

        let filter = this.connex.thor.filter("event",[{
            address:this.config.vechain.contracts.v2eBridge,
            topic0:this.UpdateMerkleRootEvent.signature
        }]).order("desc"); 

        let snapShoot:BridgeSnapshoot = {
            parentMerkleRoot:ZeroRoot(),
            merkleRoot:ZeroRoot(),
            chains:[
                {chainName:this.config.vechain.chainName,chainId:this.config.vechain.chainId,lockedBlockNum:0,beginBlockNum:0,endBlockNum:0}
            ]
        };

        const events = await filter.range({unit:"block",from:block,to:block}).apply(0,1);
        if(events.length == 1){
            let ev = events[0];
            snapShoot.merkleRoot = ev.topics[1];
            snapShoot.parentMerkleRoot = ev.topics[3];
            snapShoot.chains[0].beginBlockNum = parseInt(ev.topics[2],16);
            snapShoot.chains[0].endBlockNum = ev.meta.blockNumber;
        }
        result.data = snapShoot;
        return result;
    }

    public async getLockedStatus(): Promise<ActionData<boolean>> {
        let result = new ActionData<boolean>();
        
        try {
            const call = await this.v2eBridge.call("locked");
            result.data = Boolean(BigInt(call.decoded[0]));
        } catch (error) {
            result.error = error;
        }
        
        return result;
    }

    public async getMerkleRoot(): Promise<ActionData<string>> {
        let result = new ActionData<string>();

        try {
            const call = await this.v2eBridge.call("merkleRoot");
            result.data = String(call.decoded[0]);
        } catch (error) {
            result.error = error;
        }

        return result;
    }

    public async getLastLocked():Promise<ActionData<{txid:string,blocknum:number,root:string}>>{
        let result = new ActionData<{txid:string,blocknum:number,root:string}>();

        let filter = this.connex.thor.filter("event",[{
            address:this.config.vechain.contracts.v2eBridge,
            topic0:this.BridgeLockChangeEvent.signature,
            topic2:"0x0000000000000000000000000000000000000000000000000000000000000001"
        }]).order("desc"); 

        let begin = this.config.vechain.startBlockNum;
        let end = (await this.connex.thor.block().get())!.number;


        for(let blockNum = end;blockNum >= begin;){
            let from = blockNum - this.scanBlockStep >= begin ? blockNum - this.scanBlockStep : begin;
            let to = blockNum;
            const events = await filter.range({unit:"block",from:from,to:to}).apply(0,1);
            if(events.length == 1){
                let ev = events[0];
                result.data = {txid:ev.meta.txID,blocknum:ev.meta.blockNumber,root:ev.topics[1]};
                break;
            } else {
                blockNum = from - 1;
                continue;
            }
        }

        return result;
    }

    public async scanTxs(begin:number,end:number): Promise<ActionData<BridgeTx[]>> {
        let result = new ActionData<BridgeTx[]>();
        result.data = new Array<BridgeTx>();

        for(let block = begin; block <= end;){
            let from = block;
            let to = block + this.scanBlockStep > end ? end:block + this.scanBlockStep;

            console.debug(`scan vechain swaptxs blocknum: ${from} - ${to}`);
            
            let filter = this.connex.thor.filter("event",[
                {address:this.config.vechain.contracts.v2eBridge,topic0:this.SwapEvent.signature},
                {address:this.config.vechain.contracts.v2eBridge,topic0:this.ClaimEvent.signature}
            ]).order("asc").range({unit:"block",from:from,to:to});

            const limit = 200;
            let offset = 0;
            let eventIndex = 0;
            let blockNum = 0;
            let clauseIndex = 0;

            if(filter != undefined){
                while(true){
                    let events = await filter.apply(offset,limit);
                    for(const event of events){
                        if(blockNum != event.meta.blockNumber || clauseIndex != event.meta.clauseIndex){
                            eventIndex = 0;
                            blockNum = event.meta.blockNumber;
                            clauseIndex = event.meta.clauseIndex;
                        }
    
                        let swapTx:BridgeTx;
                        if(event.topics[0] == this.SwapEvent.signature){
                            swapTx = {
                                chainName:this.config.vechain.chainName,
                                chainId:this.config.vechain.chainId,
                                blockNumber:event.meta.blockNumber,
                                blockId:event.meta.blockID,
                                txid:event.meta.txID,
                                clauseIndex:clauseIndex,
                                index:eventIndex,
                                account:ThorDevKitEx.Bytes32ToAddress(event.topics[3]),
                                token:ThorDevKitEx.Bytes32ToAddress(event.topics[1]),
                                amount:BigInt('0x' + event.data.substring(2,66)),
                                reward:BigInt('0x' + event.data.substring(66)),
                                timestamp:event.meta.blockTimestamp,
                                type:"swap"
                            }
                            result.data.push(swapTx);
                            eventIndex++;
                        } else if (event.topics[0] == this.ClaimEvent.signature){
                            swapTx = {
                                chainName:this.config.vechain.chainName,
                                chainId:this.config.vechain.chainId,
                                blockNumber:event.meta.blockNumber,
                                blockId:event.meta.blockID,
                                txid:event.meta.txID,
                                clauseIndex:clauseIndex,
                                index:eventIndex,
                                account:ThorDevKitEx.Bytes32ToAddress(event.topics[2]),
                                token:ThorDevKitEx.Bytes32ToAddress(event.topics[1]),
                                amount:BigInt(event.data),
                                reward:BigInt(0),
                                timestamp:event.meta.blockTimestamp,
                                type:"claim"
                            }
                            result.data.push(swapTx);
                            eventIndex++;
                        }
                    }
    
                    if(events.length == limit){
                        offset = offset + limit;
                        continue;
                    } else {
                        break;
                    }
                }
            }
            block = to + 1;
        }
        return result;
    }

    public async getTokenInfos(begin:number,end:number):Promise<ActionData<TokenInfo[]>> {
        let result = new ActionData<TokenInfo[]>();
        result.data = new Array<TokenInfo>();
        let tokensMap = new Map<String,TokenInfo>();

        try {
            for(let block = begin; block <= end;){
                let from = block;
                let to = block + this.scanBlockStep > end ? end:block + this.scanBlockStep;
    
                console.debug(`scan vechain bridge tokens update: ${from} - ${to}`);
    
                let events = await this.connex.thor.filter("event",[
                    {address:this.config.vechain.contracts.v2eBridge,topic0:this.TokenUpdatedEvent.signature}
                ]).order("asc").range({unit:"block",from:from,to:to}).apply(0,200);

                for(const event of events){
                    const addr = ThorDevKitEx.Bytes32ToAddress(event.topics[1]);
                    const updated = event.meta.blockNumber;
                    const updatedBlock = event.meta.blockID;
                    const tokenInfoResult = await this.getTokenInfo(addr,updated,updatedBlock);
                    if(tokenInfoResult.error){
                        result.error = tokenInfoResult.error;
                        return result;
                    }
                    tokensMap.set(tokenInfoResult.data!.tokenid,tokenInfoResult.data!);
                }
                block = to + 1;
            }
            for(const item of tokensMap){
                result.data.push(item[1]);
            }
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    private async updateMerkleRootEvents(begin:number,end:number):Promise<ActionData<{blockNum:number,from:number,root:string,parentRoot:string}[]>>{
        let result = new ActionData<any>();
        result.data = Array();

        let filter = this.connex.thor.filter("event",[{
            address:this.v2eBridge.address,
            topic0:this.UpdateMerkleRootEvent.signature
        }]).order("desc"); 

        let eventData = {blockNum:0,from:0,root:ZeroRoot(),parentRoot:ZeroRoot()}

        for(let blockNum = end;blockNum >= begin;){
            let from = blockNum - this.scanBlockStep >= begin ? blockNum - this.scanBlockStep : begin;
            let to = blockNum;
            let events = await filter.range({unit:"block",from:from,to:to}).apply(0,1);
            if(events.length == 1){
                let ev = events[0];
                eventData = {
                    blockNum:ev.meta.blockNumber,
                    from:parseInt(ev.topics[2],16),
                    root:ev.topics[1],
                    parentRoot:ev.topics[3]
                }
                break;
            } else {
                blockNum = from - 1;
                continue;
            }
        }

        if(eventData.root == ZeroRoot()){
            return result;
        }

        result.data.push(eventData);
        
        if(eventData.from > begin && eventData.parentRoot != ZeroRoot()){
            let tagetBlock = eventData.from;
            while(true){
                let events = await filter.range({unit:"block",from:tagetBlock,to:tagetBlock}).apply(0,1);
                if(events.length == 0){
                    result.error = new Error("can't found parent merkle root");
                    return result;
                }
                let ev = events[0];
                let eventData = {
                    blockNum:ev.meta.blockNumber,
                    from:parseInt(ev.topics[2],16),
                    root:ev.topics[1],
                    parentRoot:ev.topics[3]
                }
                result.data.push(eventData);
                if(eventData.from <= begin){
                    break;
                }
                tagetBlock = eventData.from;
            }
        }
        result.data = result.data.reverse();
        return result;
    }

    private async lockChangeEvents(begin:number,end:number):Promise<ActionData<{blockNum:number,root:string,status:boolean}[]>>{
        let result = new ActionData<{blockNum:number,root:string,status:boolean}[]>();
        result.data = Array();

        let filter = this.connex.thor.filter("event",[{
            address:this.v2eBridge.address,
            topic0:this.BridgeLockChangeEvent.signature
        }]).order("desc");

        let eventData = {blockNum:0,root:ZeroRoot(),status:false}

        for(let blockNum = end;blockNum >= begin;){
            let from = blockNum - this.scanBlockStep >= begin ? blockNum - this.scanBlockStep : begin;
            let to = blockNum;
            let events = await filter.range({unit:"block",from:from,to:to}).apply(0,100);
            if(events.length > 0){
                for(const ev of events){
                    eventData = {
                        blockNum:ev.meta.blockNumber,
                        root:ev.topics[1],
                        status:Boolean(ev.topics[2] != ZeroRoot() ? true : false)
                    }
                    result.data.push(eventData);
                }
            }
            blockNum = from - 1;
        }
        result.data = result.data.reverse();
        return result;
    }

    private async getTokenInfo(addr:string,blockNum:number,blockId:string):Promise<ActionData<TokenInfo>> {
        let result = new ActionData<TokenInfo>();

        try {
            const clause = {
                to:this.config.vechain.contracts.v2eBridge,
                value:"0",
                data:this.tokensFunc.encode(addr)
            }
            const response = await Axios({
                url:this.config.vechain.nodeHost + `/accounts/*?revision=${blockNum}`,
                method:"POST",
                responseType:"json",
                data:{
                    clauses:[clause]
                }});
            const data =this.tokensFunc.decode(response.data[0].data);
            const token = new VIP180Token(addr,this.connex);
            const baseInfo = await token.baseInfo();
            
            let tokenInfo:TokenInfo = {
                tokenid:"",
                chainName:this.config.vechain.chainName,
                chainId:this.config.vechain.chainId,
                name:baseInfo.name,
                symbol:baseInfo.symbol,
                decimals:baseInfo.decimals,
                address:addr,
                nativeCoin:false,
                tokenType:String(data[0]),
                targetTokenId:"",
                begin:Number(data[2]),
                end:Number(data[3]),
                update:blockNum,
                updateBlock:blockId
            }
            tokenInfo.tokenid = tokenid(tokenInfo.chainName,tokenInfo.chainId,tokenInfo.address);
            tokenInfo.targetTokenId = tokenid(this.config.ethereum.chainName,this.config.ethereum.chainId,String(data[1]))
            result.data = tokenInfo;
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    private initV2EBridge(){
        const filePath = path.join(this.env.contractdir,"/common/Contract_BridgeHead.sol");
        const bridgeAbi = JSON.parse(compileContract(filePath,"BridgeHead","abi"));
        this.v2eBridge = new Contract({abi:bridgeAbi,connex:this.connex,address:this.config.vechain.contracts.v2eBridge});
        this.UpdateMerkleRootEvent = new abi.Event(this.v2eBridge.ABI("UpdateMerkleRoot","event") as any);
        this.SwapEvent = new abi.Event(this.v2eBridge.ABI("Swap","event") as any);
        this.ClaimEvent = new abi.Event(this.v2eBridge.ABI("Claim","event") as any);
        this.BridgeLockChangeEvent = new abi.Event(this.v2eBridge.ABI("BridgeLockChange","event") as any);
        this.TokenUpdatedEvent = new abi.Event(this.v2eBridge.ABI("TokenUpdated","event") as any);
        this.tokensFunc = new abi.Function(this.v2eBridge.ABI("tokens","function") as any);
    }

    private env:any;
    private config:any;
    private connex!:Framework;
    private readonly scanBlockStep = 100;
    private v2eBridge!:Contract;
    private UpdateMerkleRootEvent!:abi.Event;
    private SwapEvent!:abi.Event;
    private ClaimEvent!:abi.Event;
    private TokenUpdatedEvent!:abi.Event;
    private BridgeLockChangeEvent!:abi.Event;
    private tokensFunc!:abi.Function;
}