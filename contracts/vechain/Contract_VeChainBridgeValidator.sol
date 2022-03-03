// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../common/Library_ECVerify.sol";
import "../common/Library_Array.sol";

interface IBridgeCore {
    function updateMerkleRoot(bytes32 _root, bytes calldata _args) external;
}

contract BridgeValidatorControl {
    address public master;
    address public governance;
    address public bridge;
    
    
    uint16 public proposalExp = 360;
    uint16 public proposalSubmitExp = 30;

    uint8 public validatorCount;
    mapping(address => bool) public validators;

    event MasterChanged(address indexed _prev, address indexed _new);
    event ValidatorChanged(address indexed _validator, bool indexed _status);
    event GovernanceUpdate(address indexed _prev, address indexed _new);
    event BridgeUpdate(address indexed _prev,address indexed _new);
    event ProposalExpChanged(uint16 indexed _prev,uint16 indexed _value);
    event ProposalSubmitExpChanged(uint16 indexed _prev,uint16 indexed _value);

    function setMaster(address _new) external onlyMaster {
        emit MasterChanged(master, _new);
        master = _new;
    }

    function setGovernance(address _new) external {
        require(
            msg.sender == governance || msg.sender == master,
            "Permission denied:only master or governance"
        );
        emit GovernanceUpdate(governance, _new);
        governance = _new;
    }

    function setBridge(address _new) external onlyGovernance {
        emit BridgeUpdate(bridge,_new);
        bridge = _new;
    }

    function addValidator(address _new) external onlyGovernance {
        require(validators[_new] == false,"Alreadly in list");
        validators[_new] = true;
        validatorCount++;
        emit ValidatorChanged(_new,true);
    }

    function removeValidator(address _old) external onlyGovernance {
        require(validators[_old] == true,"It's not a validator");
        validators[_old] = false;
        validatorCount--;
        emit ValidatorChanged(_old,false);
    }

    function setProposalExp(uint8 _new) external onlyGovernance {
        emit ProposalExpChanged(proposalExp,_new);
        proposalExp = _new;
    }

    function setProposalSubmitExp(uint8 _new) external onlyGovernance {
        emit ProposalSubmitExpChanged(proposalSubmitExp,_new);
        proposalSubmitExp = _new;
    }

    modifier onlyMaster() {
        require(msg.sender == master, "Permission denied:only master");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "Permission denied:only governance");
        _;
    }
}

contract VeChainBridgeValidator is BridgeValidatorControl {
    struct Proposal {
        bool executed;
        uint256 createBlock;
        uint256 executblock;
        bytes32 root;
        bytes args;
        bytes[] signatures;
    }

    mapping(bytes32 => Proposal) public merkleRootProposals;

    event SubmitUpdateRoot(
        bytes32 indexed _value,
        address indexed _verifier,
        bytes _sig
    );

    event ExecOpertion(bytes32 indexed _hash);

    constructor() {
        master = msg.sender;
        governance = msg.sender;
    }

    function updateMerkleRoot(
        bytes32 _root,
        bytes calldata _args,
        bytes calldata _sig
    ) external returns(bool){
        
        bytes32 khash = keccak256(abi.encodePacked(_root,_args));

        if(merkleRootProposals[khash].createBlock == 0){
            Proposal memory _new = Proposal({
                executed:false,
                createBlock:block.number,
                executblock:0,
                root:_root,
                args:_args,
                signatures: new bytes[](0)
            });
            merkleRootProposals[khash] = _new;
        }
        Proposal storage prop = merkleRootProposals[khash];

        require(
            block.number - prop.createBlock <= proposalExp,
            "the proposal had expired"
        );

        require(
            prop.executed == false || (prop.executed == true && block.number - prop.executblock <= proposalSubmitExp),
            "the proposal had executed or submit expired"
        );

        address signer = ECVerify.ecrecovery(khash, _sig);
        require(validators[signer] == true, "signer isn't a verifier");

        require(
            ArrayLib.bytesExists(prop.signatures, _sig) == false,
            "signer already submitted"
        );
        prop.signatures.push(_sig);
        emit SubmitUpdateRoot(_root, signer, _sig);

        if (merkleRootProposals[khash].signatures.length >= quorum(validatorCount) && prop.executed == false) {
            IBridgeCore bri = IBridgeCore(bridge);
            bri.updateMerkleRoot(_root, merkleRootProposals[khash].args);
            prop.executed = true;
            prop.executblock = block.number;
            emit ExecOpertion(khash);
        }
        return true;
    }

    function getMerkleRootProposal(bytes32 _root,bytes calldata _args)
        external
        view
        returns (Proposal memory) 
    {
        bytes32 khash = keccak256(abi.encodePacked(_root,_args));
        return merkleRootProposals[khash];
    }

    function quorum(uint8 total) internal pure returns (uint8) {
        return uint8(((uint256(total) + 1) * 2) / 3);
    }
}