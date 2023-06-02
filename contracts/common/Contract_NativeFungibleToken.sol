// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./Interface_Token.sol";

contract NativeFungibleToken is IToken {
    string public  override name = "";
    string public  override symbol = "";
    uint8 public  override decimals = 0;

    event  Deposit(address indexed dst, uint wad);
    event  Withdrawal(address indexed src, uint wad);


    mapping (address => uint)                       public override balanceOf;
    mapping (address => mapping (address => uint))  public override allowance;

    constructor(string memory _name,string memory _symbol,uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    receive() external payable{
      deposit();
    }

    fallback() external payable{}

    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }
    function withdraw(uint wad) public {
        require(balanceOf[msg.sender] >= wad);
        balanceOf[msg.sender] -= wad;
        payable(msg.sender).transfer(wad);
        emit Withdrawal(msg.sender, wad);
    }

    function totalSupply() public override view returns (uint) {
        return address(this).balance;
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
