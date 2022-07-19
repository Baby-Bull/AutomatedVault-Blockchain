import React, { useState, useEffect } from "react";
import { newKit } from "@celo/contractkit";
import dotenv from "dotenv";
import Vault from "./contract/Vault.json";
import "./App.css";

import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';

// LOAD ENV VAR
dotenv.config();

const kit = newKit(process.env.REACT_APP_DATAHUB_NODE_URL);
const connectAccount = kit.addAccount(process.env.REACT_APP_PRIVATE_KEY);
// CONTRACT INSTANCE
const VaultO = new kit.web3.eth.Contract(
  Vault.abi,
  process.env.REACT_APP_VAULT_ADDRESS
);

const columns = [
  { id: 'id', label: 'Id', minWidth: 170 },
  { id: 'value', label: 'Value', minWidth: 100 },
  {
    id: 'withdrawUntil',
    label: 'Withdraw Until',
    minWidth: 170,
    align: 'right'
  },
  {
    id: 'withdrawn',
    label: 'Withdrawn',
    minWidth: 170,
    align: 'right',
  },
  {
    id: 'deposited',
    label: 'Deposited',
    minWidth: 170,
    align: 'right',
  },
];


function App() {

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(5);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };



  const [balances, setBalances] = useState({ CELO: 0, cUSD: 0, Vault: 0 });
  const [info, setInfo] = useState("");
  const [lockAmount, setLockAmount] = useState("0.3");
  const [idVault, setIdVault] = useState("0");
  const [listOfVaults, setListOfVaults] = useState([]);

  const update = () => {
    getBalanceHandle();
    getLockerIdsInfo();
  };

  const getBalanceHandle = async () => {
    const goldtoken = await kit._web3Contracts.getGoldToken();
    const totalLockedBalance = await VaultO.methods
      .getTokenTotalLockedBalance(goldtoken._address)
      .call();
    const totalBalance = await kit.getTotalBalance(
      process.env.REACT_APP_ADDRESS
    );

    const { CELO, cUSD } = totalBalance;
    setBalances({
      CELO: kit.web3.utils.fromWei(CELO.toString()),
      cUSD: kit.web3.utils.fromWei(cUSD.toString()),
      Vault: kit.web3.utils.fromWei(totalLockedBalance.toString()),
    });
  };

  const approve = async () => {
    setInfo("");
    // MAX ALLOWANCE
    const allowance = kit.web3.utils.toWei("1000000", "ether");
    // GAS ESTIMATOR
    const gasEstimate = kit.gasEstimate;
    // ASSET TO ALLOW
    const goldtoken = await kit._web3Contracts.getGoldToken();
    // TX OBJECT AND SEND
    try {
      const approveTxo = await goldtoken.methods.approve(
        process.env.REACT_APP_VAULT_ADDRESS,
        allowance
      );
      const approveTx = await kit.sendTransactionObject(approveTxo, {
        from: process.env.REACT_APP_ADDRESS,
        gasPrice: gasEstimate,
      });
      const receipt = await approveTx.waitReceipt();
      // PRINT TX RESULT
      console.log(receipt);
      setInfo("Approved!!");
    } catch (err) {
      console.log(err);
      setInfo(err.toString());
    }
  };

  const lock = async () => {
    setInfo("");
    try {
      // TIMESTAMP
      const lastBlock = await kit.web3.eth.getBlockNumber();
      let { timestamp } = await kit.web3.eth.getBlock(lastBlock);
      console.log(timestamp);
      var timestampObj = new Date(timestamp * 1000);
      // TIME TO LOCK + 1 MINS
      var unlockTime =
        timestampObj.setMinutes(timestampObj.getMinutes() + 1) / 1000; // 10 minutes by default
      // AMOUNT TO LOCK
      const amount = kit.web3.utils.toWei(lockAmount + "", "ether");
      // ERC20 TO LOCK
      const goldtoken = await kit._web3Contracts.getGoldToken();
      // TX OBJECT AND SEND
      const txo = await VaultO.methods.lockTokens(
        goldtoken._address,
        process.env.REACT_APP_ADDRESS,
        amount,
        unlockTime
      );
      const tx = await kit.sendTransactionObject(txo, {
        from: process.env.REACT_APP_ADDRESS,
      });
      // PRINT TX RESULT
      const receipt = await tx.waitReceipt();
      update();
      setInfo("Celo locked!");
      console.log(receipt);
    } catch (err) {
      console.log(err);
      setInfo(err.toString());
    }
  };

  const withdraw = async () => {
    setInfo("");
    try {
      const txo = await VaultO.methods.withdrawTokens(idVault);
      const tx = await kit.sendTransactionObject(txo, {
        from: process.env.REACT_APP_ADDRESS,
      });
      const receipt = await tx.waitReceipt();
      update();
      console.log(receipt);
      setInfo("Celo unlocked!");
    } catch (err) {
      console.log(err);
      setInfo(err.toString());
    }
  };

  const getLockerIdsInfo = async () => {
    setInfo("");
    try {
      const ids = await VaultO.methods
        .getVaultsByWithdrawer(process.env.REACT_APP_ADDRESS)
        .call();
      let vaults = [];
      for (let id of ids)
        vaults.push([id, ...(await VaultO.methods.getVaultById(id).call())]);
      console.log("IDS:", vaults);
      setListOfVaults(vaults?.reverse());
    } catch (err) {
      console.log(err);
      setInfo(err.toString());
    }
  };

  useEffect(update, []);

  return (
    <div>
      <div className="header">
        <div className="logo">
          <img
            src="https://alpaca-app-assets.alpacafinance.org/bsc-alpaca-logo.png"
            style={{
              height: "100px"
            }}
          />
          <span className="titleLogo">Vault Finance</span>
        </div>
        <div className="menu">
          <span className="IDVault">
            ID Vault: {process.env.REACT_APP_ADDRESS}
          </span>
          <div class="box" style={{
            marginTop: "2em"
          }}>
            <select className="selectBox">
              <option>
                <img src="https://alpaca-app-assets.alpacafinance.org/icons/network/binance.svg" alt="BNB Chain Mainnet" />
                Smart Chain - Testnet
              </option>
              <option>Localhost</option>
            </select>
            <select className="selectBox">
              <option>Get cover from Nexus</option>
              <option>Get cover from InsurAce</option>
            </select>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="dataWallet">
          <h1>DATA WALLET</h1>
          <ul className="dataUl">
            <li>CELO Balance In Account: {balances.CELO}</li>
            <li>cUSD Balance In Account: {balances.cUSD}</li>
            <li>Total Value Locked In Contract: {balances.Vault}</li>
          </ul>
        </div>

        <div className="actions1">
          <h1>ACTIONS:</h1>
          <div className="buttons">
            <button style={{
              background: " linear-gradient(rgb(175 255 168) 0%, rgb(75 200 75) 100%)"
            }}
              onClick={approve}>Approve</button>
            <button
              style={{
                background: "linear-gradient(rgb(148 230 245) 0%, rgb(154 100 222) 100%)"
              }}
              onClick={getBalanceHandle}>Get Balance</button>
            <button
              style={{
                background: "linear-gradient(rgb(231 158 122) 0%, rgb(245 126 112) 100%)"
              }}
              onClick={getLockerIdsInfo}>Get Locker IDS</button>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          <div style={{ margin: "0.5rem" }}>
            <h2>Lock Celo Token:</h2>
            <input
              className="inputAction"
              type="number"
              value={lockAmount}
              min="0"
              onChange={(e) => setLockAmount(e.target.value)}
            />
            <button
              className="buttonAction2"
              onClick={lock}>Lock</button>
          </div>
          <div style={{ margin: "0.5rem" }}>
            <h2>Withdraw Celo Token:</h2>
            <input
              className="inputAction"
              type="number"
              value={idVault}
              min="0"
              onChange={(e) => setIdVault(e.target.value)}
            />
            <button
              className="buttonAction2"
              onClick={withdraw}>Withdraw</button>
          </div>
        </div>

        <div className="info">
          <h1>INFO:</h1>
          <h2 style={{ color: "red" }}>{info}</h2>
          <h2>Your Vaults:</h2>

          <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 440 }}>
              <Table stickyHeader aria-label="sticky table">
                <TableHead>
                  <TableRow>
                    {columns.map((column) => (
                      <TableCell
                        key={column.id}
                        align="center"
                        style={{ minWidth: column.minWidth }}
                      >
                        {column.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {listOfVaults.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((item) => {
                    return (
                      <TableRow hover role="checkbox" tabIndex={-1} key={item.code}>
                        <TableCell align="center">
                          {item[0]}
                        </TableCell>
                        <TableCell align="center">
                          {kit.web3.utils.fromWei(item[3].toString())}
                        </TableCell>
                        <TableCell align="center">
                          {new Date(item[4] * 1000).toLocaleTimeString()}
                        </TableCell>
                        <TableCell sx={{
                          color: item[5] ? "green" : "red"
                        }}
                          align="center">
                          {item[5] ? "yes" : "no"}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: item[6] ? "green" : "red"
                          }}
                          align="center">
                          {item[6] ? "yes" : "no"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[2, 5, 10]}
              component="div"
              count={listOfVaults.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </Paper>

        </div>
      </div>
    </div >
  );
}

export default App;