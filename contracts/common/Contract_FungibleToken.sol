// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./Interface_Token.sol";

contract FungibleToken is IToken{
    string public override name = "";
    string public override symbol = "";
    uint8 public override decimals = 0;
    uint256 public override totalSupply = 0;

    mapping (address => uint)                       public override balanceOf;
    mapping (address => mapping (address => uint))  public override allowance;

    constructor(string memory _name,string memory _symbol,uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function transfer(address _to, uint256 _amount) external override returns(bool){
        return transferFrom(msg.sender,_to,_amount);
    }

    function transferFrom(address _from, address _to, uint256 _amount) public override returns(bool){
        require(balanceOf[_from] >= _amount, "insufficient balance");

        if(_from != msg.sender && allowance[_from][msg.sender] != uint256(0)){
            require(
                allowance[_from][msg.sender] >= _amount,
                "insufficient allowance"
            );
            allowance[_from][msg.sender] = allowance[_from][msg.sender] - _amount;
        }

        balanceOf[_from] = balanceOf[_from] - _amount;
        balanceOf[_to] = balanceOf[_to] + _amount;

        emit Transfer(_from, _to, _amount);
        return true;
    }

    function approve(address _spender, uint256 _amount) external override returns(bool){
        allowance[msg.sender][_spender] = _amount;
        emit Approval(msg.sender, _spender, _amount);
        return true;
    }
}