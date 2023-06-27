import { Framework } from "@vechain/connex-framework";
import { Contract } from "myvetools";
import { getReceipt } from "myvetools/dist/connexUtils";

export class VIP180Token {
    private contract:Contract;
    private agent:Framework;

    constructor(addr:string,agent:Framework){
        this.contract = new Contract({abi:this.contractAbi,connex:agent,address:addr});
        this.agent = agent;
    }

    public async name():Promise<string>{
        const call = await this.contract.call("name");
        return String(call.decoded[0]);
    }

    public async symbol():Promise<string>{
        const call = await this.contract.call("symbol");
        return String(call.decoded[0]);
    }

    public async decimals():Promise<number>{
        const call = await this.contract.call("decimals");
        return Number(call.decoded[0]);
    }

    public async totalSupply():Promise<BigInt>{
        const call = await this.contract.call("totalSupply");
        return BigInt(call.decoded[0]);
    }

    public async balanceOf(owner:string):Promise<BigInt>{
        const call = await this.contract.call("balanceOf",owner);
        return BigInt(call.decoded[0]);
    }

    public async allowance(owner:string,spender:string):Promise<BigInt>{
        const call = await this.contract.call("allowance",owner);
        return BigInt(call.decoded[0]);
    }

    public async baseInfo():Promise<{name:string,symbol:string,decimals:number}>{
        const name = await this.name();
        const symbol = await this.symbol();
        const decimals = await this.decimals();
        return {name:name,symbol:symbol,decimals:decimals};
    }

    public async transfer(amount:BigInt,to:string,origin?:string):Promise<{txid:string,logIndex:number|string,blockid:string,blockNum:number}>{
        let result = {txid:"",logIndex:0,blockid:"",blockNum:0};
        const clause = this.contract.send("transfer",0,to,'0x'+ amount.toString(16));
        const vendor = this.agent.vendor.sign('tx',[clause]);
        if(origin != undefined && origin.length != 0){
            vendor.signer(origin);
        }
        const txrep = await vendor.request();
        const receipt = await getReceipt(this.agent,6,txrep.txid);
        if(receipt != null && !receipt.reverted){
            result = {txid:txrep.txid.toLowerCase(),logIndex:0,blockid:receipt.meta.blockID.toLowerCase(),blockNum:receipt.meta.blockNumber};
        } else {
            throw new Error(`transfer faild, txid ${txrep.txid}.`);
        }
        return result;
    }

    public async transferFrom(from:string,to:string,amount:BigInt,origin?:string):Promise<{txid:string,logIndex:number|string,blockid:string,blockNum:number}>{
        let result = {txid:"",logIndex:0,blockid:"",blockNum:0};
        const clause = this.contract.send("transferFrom",0,from,to,'0x'+ amount.toString(16));11
        const vendor = this.agent.vendor.sign('tx',[clause]);
        if(origin != undefined && origin.length != 0){
            vendor.signer(origin);
        }
        const txrep = await vendor.request();
        const receipt = await getReceipt(this.agent,6,txrep.txid);
        if(receipt != null && !receipt.reverted){
            result = {txid:txrep.txid.toLowerCase(),logIndex:0,blockid:receipt.meta.blockID.toLowerCase(),blockNum:receipt.meta.blockNumber};
        } else {
            throw new Error(`transferFrom faild, txid ${txrep.txid}.`);
        }
        return result;
    }

    public async approve(spender:string,amount:BigInt,origin?:string):Promise<{txid:string,logIndex:number|string,blockid:string,blockNum:number}>{
        let result = {txid:"",logIndex:0,blockid:"",blockNum:0};
        const clause = this.contract.send("approve",0,spender,'0x'+ amount.toString(16));
        const vendor = this.agent.vendor.sign('tx',[clause]);
        if(origin != undefined && origin.length != 0){
            vendor.signer(origin);
        }
        const txrep = await vendor.request();
        const receipt = await getReceipt(this.agent,6,txrep.txid);
        if(receipt != null && !receipt.reverted){
            result = {txid:txrep.txid.toLowerCase(),logIndex:0,blockid:receipt.meta.blockID.toLowerCase(),blockNum:receipt.meta.blockNumber};
        } else {
            throw new Error(`approve faild, txid ${txrep.txid}.`);
        }
        return result;
    }

    private contractAbi = JSON.parse(`[
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "_name",
                    "type": "string"
                },
                {
                    "internalType": "string",
                    "name": "_symbol",
                    "type": "string"
                },
                {
                    "internalType": "uint8",
                    "name": "_decimals",
                    "type": "uint8"
                },
                {
                    "internalType": "address",
                    "name": "_bridge",
                    "type": "address"
                }
            ],
            "stateMutability": "nonpayable",
            "type": "constructor"
        },
        {
            "anonymous": false,
            "inputs": [
                {
                    "indexed": true,
                    "internalType": "address",
                    "name": "_from",
                    "type": "address"
                },
                {
                    "indexed": true,
                    "internalType": "address",
                    "name": "_to",
                    "type": "address"
                },
                {
                    "indexed": false,
                    "internalType": "uint256",
                    "name": "_amount",
                    "type": "uint256"
                }
            ],
            "name": "Approval",
            "type": "event",
            "signature": "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"
        },
        {
            "anonymous": false,
            "inputs": [
                {
                    "indexed": true,
                    "internalType": "address",
                    "name": "_from",
                    "type": "address"
                },
                {
                    "indexed": true,
                    "internalType": "address",
                    "name": "_to",
                    "type": "address"
                },
                {
                    "indexed": false,
                    "internalType": "uint256",
                    "name": "_amount",
                    "type": "uint256"
                }
            ],
            "name": "Transfer",
            "type": "event",
            "signature": "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "",
                    "type": "address"
                },
                {
                    "internalType": "address",
                    "name": "",
                    "type": "address"
                }
            ],
            "name": "allowance",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function",
            "constant": true,
            "signature": "0xdd62ed3e"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "_spender",
                    "type": "address"
                },
                {
                    "internalType": "uint256",
                    "name": "_amount",
                    "type": "uint256"
                }
            ],
            "name": "approve",
            "outputs": [
                {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                }
            ],
            "stateMutability": "nonpayable",
            "type": "function",
            "signature": "0x095ea7b3"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "",
                    "type": "address"
                }
            ],
            "name": "balanceOf",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function",
            "constant": true,
            "signature": "0x70a08231"
        },
        {
            "inputs": [],
            "name": "bridge",
            "outputs": [
                {
                    "internalType": "address",
                    "name": "",
                    "type": "address"
                }
            ],
            "stateMutability": "view",
            "type": "function",
            "constant": true,
            "signature": "0xe78cea92"
        },
        {
            "inputs": [],
            "name": "decimals",
            "outputs": [
                {
                    "internalType": "uint8",
                    "name": "",
                    "type": "uint8"
                }
            ],
            "stateMutability": "view",
            "type": "function",
            "constant": true,
            "signature": "0x313ce567"
        },
        {
            "inputs": [],
            "name": "name",
            "outputs": [
                {
                    "internalType": "string",
                    "name": "",
                    "type": "string"
                }
            ],
            "stateMutability": "view",
            "type": "function",
            "constant": true,
            "signature": "0x06fdde03"
        },
        {
            "inputs": [],
            "name": "symbol",
            "outputs": [
                {
                    "internalType": "string",
                    "name": "",
                    "type": "string"
                }
            ],
            "stateMutability": "view",
            "type": "function",
            "constant": true,
            "signature": "0x95d89b41"
        },
        {
            "inputs": [],
            "name": "totalSupply",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function",
            "constant": true,
            "signature": "0x18160ddd"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "_to",
                    "type": "address"
                },
                {
                    "internalType": "uint256",
                    "name": "_amount",
                    "type": "uint256"
                }
            ],
            "name": "transfer",
            "outputs": [
                {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                }
            ],
            "stateMutability": "nonpayable",
            "type": "function",
            "signature": "0xa9059cbb"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "_from",
                    "type": "address"
                },
                {
                    "internalType": "address",
                    "name": "_to",
                    "type": "address"
                },
                {
                    "internalType": "uint256",
                    "name": "_amount",
                    "type": "uint256"
                }
            ],
            "name": "transferFrom",
            "outputs": [
                {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                }
            ],
            "stateMutability": "nonpayable",
            "type": "function",
            "signature": "0x23b872dd"
        }
    ]`); 
}