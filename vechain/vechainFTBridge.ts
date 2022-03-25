import { Framework } from "@vechain/connex-framework";
import { Contract } from "myvetools";
import { compileContract } from "myvetools/dist/utils";
import path from "path";
import { abi } from "thor-devkit";
import { ActionData, ActionResult } from "../utils/components/actionResult";
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
                            swapTxHash:evDecode[0] as string,
                            token:evDecode[1] as string,
                            amount:BigInt(0),
                            timestamp:ev.meta.blockTimestamp,
                            recipient:evDecode[2] as string,
                            type:BridgeTxType.swap,
                            from:evDecode[3] as string,
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
                            swapTxHash:evDecode[0] as string,
                            token:evDecode[1] as string,
                            recipient:evDecode[2] as string,
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
                    const tokenAddr = evDecode[0] as string;
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
                        nativeCoin:evDecode._native as boolean,
                        tokenType:evDecode._type as number,
                        targetTokenAddr:evDecode._ttoken as string,
                        targetChainName:this.config.ethereum.chainName,
                        targetChainId:this.config.ethereum.chainId,
                        begin:evDecode._begin as number,
                        end:evDecode._end as number,
                        reward:evDecode._reward as number,
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