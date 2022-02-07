// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

contract FTBridgeControl {
    address public master;
    address public governance;

    bool public govLocked = false;
    bool public masterLocked = false;

    event MasterChanged(address indexed _prev, address indexed _new);
    event GovernanceChanged(address indexed _prev, address indexed _new);
    event BridgeCoreChanged(address indexed _prev,address indexed _new, bytes32 indexed _appid);
    event MasterLockChanged(bool indexed _value);
    event GovLockChanaged(bool indexed _value);

    constructor(){
        master = msg.sender;
        governance = msg.sender;
    }

    function setMaster(address _new) external {
        require(
            msg.sender == governance || msg.sender == master,
            "Permission denied"
        );
        emit MasterChanged(master, _new);
        master = _new;
    }

    function setGovernance(address _new) external {
        require(
            msg.sender == governance || msg.sender == master,
            "Permission denied"
        );
        emit GovernanceChanged(governance, _new);
        governance = _new;
    }

    function setMasterLock(bool _value) external {
        require(msg.sender == master, "Permission denied");
        masterLocked = _value;
        emit MasterLockChanged(_value);
    }

    function setGovLock(bool _value) external {
        require(msg.sender == governance, "Permission denied");
        govLocked = _value;
        emit GovLockChanaged(_value);
    }
}