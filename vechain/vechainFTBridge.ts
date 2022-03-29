import { Framework } from "@vechain/connex-framework";
import { Contract } from "myvetools";
import { abi } from "thor-devkit";
import { ActionData } from "../utils/components/actionResult";
import { BaseBridgeTx, bridgeTxId, BridgeTxType, ClaimBridgeTx, SwapBridgeTx, swapTxHash } from "../utils/types/bridgeTx";
import { tokenid, TokenInfo } from "../utils/types/tokenInfo";
import { getAllEvents } from "./vechainCommon";
import { VIP180Token } from "./vip180Token";

export class VeChainFTBridge {

    constructor(env:any){
        this.env = env;
        this.config = env.config;
        this.connex = env.connex;
        this.initContract();
    }

    public async getBridgeTxByRange(begin:number,end:number):Promise<ActionData<BaseBridgeTx[]>> {
        let result = new ActionData<BaseBridgeTx[]>();
        result.data = new Array();

        try {
            for(let block = begin; block <= end;){
                let from = block;
                let to = block + this.scanBlockStep > end ? end:block + this.scanBlockStep;

                const filter = this.connex.thor.filter('event',[
                    {address:this.config.vechain.contracts.ftBridge,topic0:this.swapEvent.signature},
                    {address:this.config.vechain.contracts.ftBridge,topic0:this.claimEvent.signature}
                ]).order('asc').range({unit:'block',from:from,to:to});

                console.debug(`scan vechain bridge txs blocknum: ${from} - ${to}`);

                const events = await getAllEvents(filter);

                let evIndex = 0;
                let blockid = "";
               
                for(const ev of events){
                    if(blockid != ev.meta.blockID){
                        evIndex = 0;
                        blockid = ev.meta.blockID;
                    }
                    if(ev.topics[0] == this.swapEvent.signature){
                        const evDecode = this.swapEvent.decode(ev.data,ev.topics);
                        const swaptx:SwapBridgeTx = {
                            bridgeTxId:"",
                            chainName:this.config.vechain.chainName,
                            chainId:this.config.vechain.chainId,
                            blockNumber:ev.meta.blockNumber,
                            blockId:ev.meta.blockID,
                            txid:ev.meta.txID,
                            index:evIndex,
                            swapTxHash:String(evDecode[0]),
                            token:String(evDecode[1]),
                            amount:BigInt(0),
                            timestamp:ev.meta.blockTimestamp,
                            recipient:String(evDecode[2]),
                            type:BridgeTxType.swap,
                            from:String(evDecode[3]),
                            amountOut:BigInt(evDecode[4]),
                            reward:BigInt(evDecode[5]),
                            swapCount:BigInt(evDecode[6])
                        }
                        swaptx.bridgeTxId = bridgeTxId(swaptx);
                        swaptx.amount = swaptx.reward + swaptx.amountOut;
                        result.data.push(swaptx);
                    } else if (ev.topics[0] == this.claimEvent.signature){
                        const evDecode = this.claimEvent.decode(ev.data,ev.topics);
                        const claimtx:ClaimBridgeTx = {
                            bridgeTxId:"",
                            chainName:this.config.vechain.chainName,
                            chainId:this.config.vechain.chainId,
                            blockNumber:ev.meta.blockNumber,
                            blockId:ev.meta.blockID,
                            txid:ev.meta.txID,
                            index:evIndex,
                            swapTxHash:String(evDecode[0]),
                            token:String(evDecode[1]),
                            recipient:String(evDecode[2]),
                            amount:BigInt(evDecode[3]),
                            timestamp:ev.meta.blockTimestamp,
                            type:BridgeTxType.claim
                        }
                        claimtx.bridgeTxId = bridgeTxId(claimtx);
                        result.data.push(claimtx);
                    }
                    evIndex++;
                }
                
                block = to + 1;
            }
        } catch (error) {
            result.error = error;
        }

        return result;
    }

    public async getTokenInfosByRange(begin:number,end:number):Promise<ActionData<TokenInfo[]>>{
        let result = new ActionData<TokenInfo[]>();
        result.data = new Array();

        try {
            for(let block = begin; block <= end;){
                let from = block;
                let to = block + this.scanBlockStep > end ? end:block + this.scanBlockStep;
                
                console.debug(`scan vechain tokenInfos blocknum: ${from} - ${to}`);

                const filter = this.connex.thor.filter('event',[{
                    address:this.ftBridgeTokens.address,topic0:this.tokenUpdatedEvent.signature
                }]).order('asc').range({unit:'block',from:from,to:to});

                const events = await getAllEvents(filter);

                for(const ev of events){
                    const evDecode = this.tokenUpdatedEvent.decode(ev.data,ev.topics);
                    const tokenAddr = String(evDecode[0]);
                    const token = new VIP180Token(tokenAddr,this.connex);
                    const baseInfo = await token.baseInfo();
                    const tokenInfo:TokenInfo = {
                        tokenid:"",
                        chainName:this.config.vechain.chainName,
                        chainId:this.config.vechain.chainId,
                        name:baseInfo.name,
                        symbol:baseInfo.symbol,
                        decimals:baseInfo.decimals,
                        tokenAddr:tokenAddr,
                        nativeCoin:Boolean(evDecode._native),
                        tokenType:Number(evDecode._type),
                        targetTokenAddr:String(evDecode._ttoken),
                        targetChainName:this.config.ethereum.chainName,
                        targetChainId:this.config.ethereum.chainId,
                        begin:Number(evDecode._begin),
                        end:Number(evDecode._end),
                        reward:Number(evDecode._reward),
                        updateBlockNum:ev.meta.blockNumber,
                        updateBlockId:ev.meta.blockID
                    }
                    tokenInfo.tokenid = tokenid(tokenInfo.chainName,tokenInfo.chainId,tokenInfo.tokenAddr);
                    result.data.push(tokenInfo);
                }
                block = to + 1;
            }
        } catch (error) {
            result.error = error;   
        }
        return result;
    }

    private initContract(){
        this.ftBridge = this.env.contracts.vechain.ftBridge;
        this.swapEvent = new abi.Event(this.ftBridge.ABI('Swap','event') as any);
        this.claimEvent = new abi.Event(this.ftBridge.ABI('Claim','event') as any);

        this.ftBridgeTokens = this.env.contracts.vechain.ftBridgeTokens;
        this.tokenUpdatedEvent = new abi.Event(this.ftBridgeTokens.ABI('TokenUpdated','event') as any);
    }

    private env:any;
    private config:any;
    private connex!:Framework;
    private readonly scanBlockStep = 200;
    private ftBridge!:Contract;
    private ftBridgeTokens!:Contract;
    private swapEvent!:abi.Event;
    private claimEvent!:abi.Event;
    private tokenUpdatedEvent!:abi.Event;
}