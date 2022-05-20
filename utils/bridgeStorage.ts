import { keccak256 } from "thor-devkit";
import MerkleTree, { TreeNode } from "./merkleTree";
import { BridgeSnapshoot, ChainInfo } from "./types/bridgeSnapshoot";
import { HashEvent } from "./types/hashEvent";

export default class BridgeStorage {

    private tree:MerkleTree;
    private merkleRootNode:TreeNode;

    constructor(){
        this.tree = MerkleTree.createNewTree();
        this.merkleRootNode = TreeNode.EmptyTreeNode();
    }

    public buildTree(appid:string,newSnapshoot:BridgeSnapshoot,events:HashEvent[]):TreeNode {
        this.tree = MerkleTree.createNewTree();
        const sorted:Array<HashEvent> = events.sort((l,r) => {
            return BigInt(l.hash) > BigInt(r.hash) ? 1 : -1;
        });
        
        let infoHash = BridgeStorage.snapshootHash(newSnapshoot.chains);
        this.tree.addHash(infoHash);

        sorted.forEach(event => {
            this.tree.addHash(BridgeStorage.leaf(appid,event.hash));
        });

        this.merkleRootNode = this.tree.buildTree();
        return this.merkleRootNode;
    }

    public static leaf(appid:string,eventhash:string):string {
        const buff = Buffer.concat([
            Buffer.from(appid.substring(2),'hex'),
            Buffer.from(eventhash.substring(2),'hex')
        ]);
        return '0x' + keccak256(buff).toString('hex');
    }

    public getMerkleRoot():string{
        return this.merkleRootNode.nodeHash;
    }

    public getMerkleProof(appid:string,eventhash:string):Array<string>{
        const hash = BridgeStorage.leaf(appid,eventhash);
        return this.tree.getMerkleProof(hash);
    }

    public static verificationMerkleProof(appid:string,eventhash:string,root:string,proof:Array<string>):boolean{
        const hash = BridgeStorage.leaf(appid,eventhash);
        return MerkleTree.verificationMerkleProof(hash,root,proof);
    }

    public static snapshootEncodePacked(chains:ChainInfo[]):Buffer {
        let sorted = chains.sort((l,r) => {
            if(l.chainName.toLocaleLowerCase() != r.chainName.toLocaleLowerCase()){
                return l.chainName > r.chainName ? 1 : -1 ;
            } else {
                return l.chainId >= r.chainId ? 1 : -1 ;
            }
        });

        let encode:Buffer = Buffer.alloc(0);
        sorted.forEach(chain => {
            let chainBuff = Buffer.concat([
                Buffer.from(chain.chainName),
                Buffer.from(chain.chainId),
                Buffer.from(BigInt(chain.beginBlockNum).toString(16),'hex'),
                Buffer.from(BigInt(chain.endBlockNum).toString(16),'hex'),
            ]);
            encode = Buffer.concat([chainBuff]);
        });

        return encode;
    }

    public static snapshootHash(chains:ChainInfo[]):string {
        return '0x' + keccak256(BridgeStorage.snapshootEncodePacked(chains)).toString('hex');
    }
    
}