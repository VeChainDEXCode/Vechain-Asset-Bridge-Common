import Web3 from "web3";
import { Contract } from "web3-eth-contract";

export class ERC20Token {
    private contract:Contract;
    private agent:Web3;

    constructor(addr:string,agent:Web3){
        this.contract = new agent.eth.Contract(this.contractAbi,addr);
        this.agent = agent;
    }

    public async name():Promise<string>{
        const call = await this.contract.methods.name().call();
        return String(call);
    }

    public async symbol():Promise<string>{
        const call = await this.contract.methods.symbol().call();
        return String(call);
    }

    public async decimals():Promise<number>{
        const call = await this.contract.methods.decimals().call();
        return Number(call);
    }

    public async totalSupply():Promise<BigInt>{
        const call = await this.contract.methods.totalSupply().call();
        return BigInt(call);
    }

    public async balanceOf(owner:string):Promise<BigInt>{
        const call = await this.contract.methods.balanceOf().call();
        return BigInt(call);
    }

    public async allowance(owner:string,spender:string):Promise<BigInt>{
        const call = await this.contract.methods.balanceOf(owner,spender).call();
        return BigInt(call);
    }

    public async baseInfo():Promise<{name:string,symbol:string,decimals:number}>{
        const name = await this.name();
        const symbol = await this.symbol();
        const decimals = await this.decimals();
        return {name:name,symbol:symbol,decimals:decimals};
    }

    public async transfer(amount:BigInt,to:string,origin?:string):Promise<{txid:string,logIndex:number|string,blockid:string,blockNum:number}> {
        let result = {txid:"",logIndex:0,blockid:"",blockNum:0};
        const method = this.contract.methods.transfer(amount,to);
        const ori = origin != undefined && origin.length == 42 ? origin : this.agent.eth.accounts.wallet[0].address;
        const gasPrice = await this.agent.eth.getGasPrice();
        const gas = await method.estimateGas({from:ori,value:0});
        await method.send({from:ori,value:0,gas:gas,gasPrice:gasPrice})
            .on('receipt',(recp:any) => {
                result.txid = recp.transactionHash.toLowerCase();
                result.logIndex = 0;
                result.blockid = recp.blockHash.toLowerCase();
                result.blockNum = recp.blockNumber;
                if(!recp.status){
                    throw new Error(`transfer faild, txid ${result.txid}.`);
                }
            })
            .on('error,',() => {
                throw new Error(`transfer faild.`);
            });

        return result;
    }

    public async transferFrom(from:string,to:string,amount:BigInt,origin?:string):Promise<{txid:string,logIndex:number|string,blockid:string,blockNum:number}>{
        let result = {txid:"",logIndex:0,blockid:"",blockNum:0};
        const method = this.contract.methods.transferFrom(from,amount,to);
        const ori = origin != undefined && origin.length == 42 ? origin : this.agent.eth.accounts.wallet[0].address;
        const gasPrice = await this.agent.eth.getGasPrice();
        const gas = await method.estimateGas({from:ori,value:0});
        await method.send({from:ori,value:0,gas:gas,gasPrice:gasPrice})
            .on('receipt',(recp:any) => {
                result.txid = recp.transactionHash.toLowerCase();
                result.logIndex = 0;
                result.blockid = recp.blockHash.toLowerCase();
                result.blockNum = recp.blockNumber;
                if(!recp.status){
                    throw new Error(`transferFrom faild, txid ${result.txid}.`);
                }
            })
            .on('error,',() => {
                throw new Error(`transferFrom faild.`);
            });

        return result;
    }

    public async approve(spender:string,amount:BigInt,origin?:string):Promise<{txid:string,logIndex:number|string,blockid:string,blockNum:number}>{
        let result = {txid:"",logIndex:0,blockid:"",blockNum:0};
        const method = this.contract.methods.approve(spender,amount);
        const ori = origin != undefined && origin.length == 42 ? origin : this.agent.eth.accounts.wallet[0].address;
        const gasPrice = await this.agent.eth.getGasPrice();
        const gas = await method.estimateGas({from:ori,value:0});
        await method.send({from:ori,value:0,gas:gas,gasPrice:gasPrice})
            .on('receipt',(recp:any) => {
                result.txid = recp.transactionHash.toLowerCase();
                result.logIndex = 0;
                result.blockid = recp.blockHash.toLowerCase();
                result.blockNum = recp.blockNumber;
                if(!recp.status){
                    throw new Error(`approve faild, txid ${result.txid}.`);
                }
            })
            .on('error,',() => {
                throw new Error(`approve faild.`);
            });

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