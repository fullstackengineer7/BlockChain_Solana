import { useCallback, useEffect, useMemo, useState } from "react";
import * as anchor from "@project-serum/anchor";

import styled from "styled-components";
import { Container, Snackbar } from "@material-ui/core";
import Paper from "@material-ui/core/Paper";
import Alert from "@material-ui/lab/Alert";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import PowerGif from "../assets/images/power.gif";
import {
  Commitment,
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletDialogButton } from "@solana/wallet-adapter-material-ui";
import {
  awaitTransactionSignatureConfirmation,
  CANDY_MACHINE_PROGRAM,
  CandyMachineAccount,
  createAccountsForMint,
  getCandyMachineState,
  getCollectionPDA,
  mintOneToken,
  SetupState,
} from "./candy-machine";
import {
  connectWalletLocaly
} from "../config.js"
import Button from "../common/button";
import { AlertState, formatNumber, getAtaForMint, toDate } from "./utils";
import { MintCountdown } from "./MintCountdown";
import { MintButton } from "./MintButton";
import { GatewayProvider } from "@civic/solana-gateway-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

const ConnectButton = styled(WalletDialogButton)`
color: white !important;
background-color: rgba(255,255,255,0) !important;
border: 2px solid rgba(255,255,255,0.2) !important;
:hover {
  background-color: rgba(255,255,255,0.2) !important;
}
`;

const ModalHeader = styled.div`
  display: flex;
`

const ModalClose = styled.button`
background: transparent;
border: none;
outline: none;
height: 45px;
width: 45px;
position: absolute;
right: 5.1%;
top: 0.1%;
overflow: hidden;
display: flex;
-webkit-box-pack: end;
justify-content: end;
-webkit-box-align: baseline;
align-items: baseline;
&:before {
  content: "";
    background: rgba(255, 255, 255, 0.1);
    height: 150%;
    width: 150%;
    position: absolute;
    right: -35px;
    top: -35px;
    transform: rotate(45deg);
}
`

const ModalTitle = styled.div`
font-family: "Bakbak One";
font-style: normal;
font-weight: 400;
font-size: 24px;
line-height: 28px;
text-align: center;
text-transform: uppercase;
color: rgb(255, 255, 255);
max-width: 280px;
margin: auto auto 26px;
margin-top: 26px;
`;

const ModalNft = styled.img`
  width: 200px;
  height: 200px;
  text-align: center;
  margin-bottom: 26px;
`
const ModalItem = styled.div`
display:flex;
border-bottom: 1px solid rgba(255, 255, 255, 0.1);
padding:15px;
`

const MintContainer = styled.div``; // add your owns styles here

export interface HomeProps {
  visibility?: boolean;
  onClose: any;
  candyMachineId?: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  txTimeout: number;
  rpcHost: string;
  network: WalletAdapterNetwork;
  error?: string;
  setRemaining: any;
  setStopMintDate: any;
}

const Minting = (props: HomeProps) => {
  const [isUserMinting, setIsUserMinting] = useState(false);
  const [candyMachine, setCandyMachine] = useState<CandyMachineAccount>();
  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });
  const [isActive, setIsActive] = useState(false);
  const [endDate, setEndDate] = useState<Date>();
  // const [stopMinting, setStopMinting] = useState<Date>();
  const [itemsRemaining, setItemsRemaining] = useState<number>();
  const [isWhitelistUser, setIsWhitelistUser] = useState(false);
  const [isPresale, setIsPresale] = useState(false);
  const [isValidBalance, setIsValidBalance] = useState(false);
  const [discountPrice, setDiscountPrice] = useState<anchor.BN>();
  const [needTxnSplit, setNeedTxnSplit] = useState(true);
  const [setupTxn, setSetupTxn] = useState<SetupState>();

  useEffect(()=>{
    props.setRemaining(itemsRemaining)
  },[itemsRemaining]);
  
  // useEffect(()=>{
  //   props.setStopMintDate(endDate)
  // },[endDate]);

  const rpcUrl = props.rpcHost;
  const wallet = useWallet();
  const cluster = props.network;
  const anchorWallet = useMemo(() => {
    if (
      !wallet ||
      !wallet.publicKey ||
      !wallet.signAllTransactions ||
      !wallet.signTransaction
    ) {
      return;
    }

    return {
      publicKey: wallet.publicKey,
      signAllTransactions: wallet.signAllTransactions,
      signTransaction: wallet.signTransaction,
    } as anchor.Wallet;
  }, [wallet]);

  const refreshCandyMachineState = useCallback(
    async (commitment: Commitment = "confirmed") => {
      if (!anchorWallet) {
        return;
      }
      if (props.error !== undefined) {
        setAlertState({
          open: true,
          message: props.error,
          severity: "error",
          hideDuration: null,
        });
        return;
      }

      const connection = new Connection(props.rpcHost, commitment);

      if (props.candyMachineId) {
        try {
          const cndy = await getCandyMachineState(
            anchorWallet,
            props.candyMachineId,
            connection
          );
          console.log("Candy machine state: ", cndy);
          let active = cndy?.state.goLiveDate
            ? cndy?.state.goLiveDate.toNumber() < new Date().getTime() / 1000
            : false;
          let presale = false;

          // duplication of state to make sure we have the right values!
          let isWLUser = false;
          let userPrice = cndy.state.price;

          // whitelist mint?
          if (cndy?.state.whitelistMintSettings) {
            // is it a presale mint?
            if (
              cndy.state.whitelistMintSettings.presale &&
              (!cndy.state.goLiveDate ||
                cndy.state.goLiveDate.toNumber() > new Date().getTime() / 1000)
            ) {
              presale = true;
            }
            // is there a discount?
            if (cndy.state.whitelistMintSettings.discountPrice) {
              setDiscountPrice(cndy.state.whitelistMintSettings.discountPrice);
              userPrice = cndy.state.whitelistMintSettings.discountPrice;
            } else {
              setDiscountPrice(undefined);
              // when presale=false and discountPrice=null, mint is restricted
              // to whitelist users only
              if (!cndy.state.whitelistMintSettings.presale) {
                cndy.state.isWhitelistOnly = true;
              }
            }
            // retrieves the whitelist token
            const mint = new anchor.web3.PublicKey(
              cndy.state.whitelistMintSettings.mint
            );
            const token = (
              await getAtaForMint(mint, anchorWallet.publicKey)
            )[0];

            try {
              const balance = await connection.getTokenAccountBalance(token);
              isWLUser = parseInt(balance.value.amount) > 0;
              // only whitelist the user if the balance > 0
              setIsWhitelistUser(isWLUser);

              if (cndy.state.isWhitelistOnly) {
                active = isWLUser && (presale || active);
              }
            } catch (e) {
              setIsWhitelistUser(false);
              // no whitelist user, no mint
              if (cndy.state.isWhitelistOnly) {
                active = false;
              }
              console.log(
                "There was a problem fetching whitelist token balance"
              );
              console.log(e);
            }
          }
          userPrice = isWLUser ? userPrice : cndy.state.price;

          if (cndy?.state.tokenMint) {
            // retrieves the SPL token
            const mint = new anchor.web3.PublicKey(cndy.state.tokenMint);
            const token = (
              await getAtaForMint(mint, anchorWallet.publicKey)
            )[0];
            try {
              const balance = await connection.getTokenAccountBalance(token);

              const valid = new anchor.BN(balance.value.amount).gte(userPrice);

              // only allow user to mint if token balance >  the user if the balance > 0
              setIsValidBalance(valid);
              active = active && valid;
            } catch (e) {
              setIsValidBalance(false);
              active = false;
              // no whitelist user, no mint
              console.log("There was a problem fetching SPL token balance");
              console.log(e);
            }
          } else {
            const balance = new anchor.BN(
              await connection.getBalance(anchorWallet.publicKey)
            );
            const valid = balance.gte(userPrice);
            setIsValidBalance(valid);
            active = active && valid;
          }

          if (cndy?.state.endSettings?.endSettingType.date) {
            // setStopMinting(toDate(cndy.state.endSettings.number));
            setEndDate(toDate(cndy.state.endSettings.number));
            if (
              cndy.state.endSettings.number.toNumber() <
              new Date().getTime() / 1000
            ) {
              active = false;
            }
          }
          // amount to stop the mint?
          if (cndy?.state.endSettings?.endSettingType.amount) {
            const limit = Math.min(
              cndy.state.endSettings.number.toNumber(),
              cndy.state.itemsAvailable
            );
            if (cndy.state.itemsRedeemed < limit) {
              setItemsRemaining(limit - cndy.state.itemsRedeemed);
            } else {
              setItemsRemaining(0);
              cndy.state.isSoldOut = true;
            }
          } else {
            setItemsRemaining(cndy.state.itemsRemaining);
          }

          if (cndy.state.isSoldOut) {
            active = false;
          }

          const [collectionPDA] = await getCollectionPDA(props.candyMachineId);
          const collectionPDAAccount = await connection.getAccountInfo(
            collectionPDA
          );

          setIsActive((cndy.state.isActive = active));
          setIsPresale((cndy.state.isPresale = presale));
          setCandyMachine(cndy);

          const txnEstimate =
            892 +
            (!!collectionPDAAccount && cndy.state.retainAuthority ? 182 : 0) +
            (cndy.state.tokenMint ? 66 : 0) +
            (cndy.state.whitelistMintSettings ? 34 : 0) +
            (cndy.state.whitelistMintSettings?.mode?.burnEveryTime ? 34 : 0) +
            (cndy.state.gatekeeper ? 33 : 0) +
            (cndy.state.gatekeeper?.expireOnUse ? 66 : 0);

          setNeedTxnSplit(txnEstimate > 1230);
        } catch (e) {
          if (e instanceof Error) {
            if (
              e.message === `Account does not exist ${props.candyMachineId}`
            ) {
              setAlertState({
                open: true,
                message: `Couldn't fetch candy machine state from candy machine with address: ${props.candyMachineId}, using rpc: ${props.rpcHost}! You probably typed the REACT_APP_CANDY_MACHINE_ID value in wrong in your .env file, or you are using the wrong RPC!`,
                severity: "error",
                hideDuration: null,
              });
            } else if (
              e.message.startsWith("failed to get info about account")
            ) {
              setAlertState({
                open: true,
                message: `Couldn't fetch candy machine state with rpc: ${props.rpcHost}! This probably means you have an issue with the REACT_APP_SOLANA_RPC_HOST value in your .env file, or you are not using a custom RPC!`,
                severity: "error",
                hideDuration: null,
              });
            }
          } else {
            setAlertState({
              open: true,
              message: `${e}`,
              severity: "error",
              hideDuration: null,
            });
          }
          console.log(e);
        }
      } else {
        setAlertState({
          open: true,
          message: `Your REACT_APP_CANDY_MACHINE_ID value in the .env file doesn't look right! Make sure you enter it in as plain base-58 address!`,
          severity: "error",
          hideDuration: null,
        });
      }
    },
    [anchorWallet, props.candyMachineId, props.error, props.rpcHost]
  );

  const onMint = async (
    beforeTransactions: Transaction[] = [],
    afterTransactions: Transaction[] = []
  ) => {
    try {
      setIsUserMinting(true);
      if (wallet.connected && candyMachine?.program && wallet.publicKey) {
        let setupMint: SetupState | undefined;
        if (needTxnSplit && setupTxn === undefined) {
          setAlertState({
            open: true,
            message: "Please sign account setup transaction",
            severity: "info",
          });
          setupMint = await createAccountsForMint(
            candyMachine,
            wallet.publicKey
          );
          let status: any = { err: true };
          if (setupMint.transaction) {
            status = await awaitTransactionSignatureConfirmation(
              setupMint.transaction,
              props.txTimeout,
              props.connection,
              true
            );
          }
          if (status && !status.err) {
            setSetupTxn(setupMint);
            setAlertState({
              open: true,
              message:
                "Setup transaction succeeded! Please sign minting transaction",
              severity: "info",
            });
          } else {
            setAlertState({
              open: true,
              message: "Mint failed! Please try again!",
              severity: "error",
            });
            setIsUserMinting(false);
            return;
          }
        } else {
          setAlertState({
            open: true,
            message: "Please sign minting transaction",
            severity: "info",
          });
        }

        const mintResult = await mintOneToken(
          candyMachine,
          wallet.publicKey,
          beforeTransactions,
          afterTransactions,
          setupMint ?? setupTxn
        );

        let status: any = { err: true };
        let metadataStatus = null;
        if (mintResult) {
          status = await awaitTransactionSignatureConfirmation(
            mintResult.mintTxId,
            props.txTimeout,
            props.connection,
            true
          );

          metadataStatus =
            await candyMachine.program.provider.connection.getAccountInfo(
              mintResult.metadataKey,
              "processed"
            );
          console.log("Metadata status: ", !!metadataStatus);
        }

        if (status && !status.err && metadataStatus) {
          // manual update since the refresh might not detect
          // the change immediately
          const remaining = itemsRemaining! - 1;
          setItemsRemaining(remaining);
          setIsActive((candyMachine.state.isActive = remaining > 0));
          candyMachine.state.isSoldOut = remaining === 0;
          setSetupTxn(undefined);
          setAlertState({
            open: true,
            message: "Congratulations! Mint succeeded!",
            severity: "success",
            hideDuration: 7000,
          });
          refreshCandyMachineState("processed");
        } else if (status && !status.err) {
          setAlertState({
            open: true,
            message:
              "Mint likely failed! Anti-bot SOL 0.01 fee potentially charged! Check the explorer to confirm the mint failed and if so, make sure you are eligible to mint before trying again.",
            severity: "error",
            hideDuration: 8000,
          });
          refreshCandyMachineState();
        } else {
          setAlertState({
            open: true,
            message: "Mint failed! Please try again!",
            severity: "error",
          });
          refreshCandyMachineState();
        }
      }
    } catch (error: any) {
      let message = error.msg || "Minting failed! Please try again!";
      if (!error.msg) {
        if (!error.message) {
          message = "Transaction timeout! Please try again.";
        } else if (error.message.indexOf("0x137")) {
          console.log(error);
          message = `SOLD OUT!`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          console.log(error);
          message = `SOLD OUT!`;
          window.location.reload();
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }

      setAlertState({
        open: true,
        message,
        severity: "error",
      });
      // updates the candy machine state to reflect the latest
      // information on chain
      refreshCandyMachineState();
    } finally {
      setIsUserMinting(false);
    }
  };

  const toggleMintButton = () => {
    let active = !isActive || isPresale;

    if (active) {
      if (candyMachine!.state.isWhitelistOnly && !isWhitelistUser) {
        active = false;
      }
      if (endDate && Date.now() >= endDate.getTime()) {
        active = false;
      }
    }

    if (
      isPresale &&
      candyMachine!.state.goLiveDate &&
      candyMachine!.state.goLiveDate.toNumber() <= new Date().getTime() / 1000
    ) {
      setIsPresale((candyMachine!.state.isPresale = false));
    }

    setIsActive((candyMachine!.state.isActive = active));
  };

  useEffect(() => {
    refreshCandyMachineState();
  }, [
    anchorWallet,
    props.candyMachineId,
    props.connection,
    refreshCandyMachineState,
  ]);

  useEffect(() => {
    (function loop() {
      setTimeout(() => {
        refreshCandyMachineState();
        loop();
      }, 20000);
    })();
  }, [refreshCandyMachineState]);
  
  if(!wallet.connected) {
    return (
      <>
        <ConnectButton>Connect Wallet</ConnectButton>
        {
          props.visibility && (
            <>
              <div onClick={ props.onClose } style={{position:'fixed', left:0, top: 0, width: '100vw', height:'100vh'}}></div>
                <Container style={{ maxWidth: '500px', position: 'fixed', left:'50%', top: '50vh', transform: 'translate(-50%, -50%)'}}>
                  <Container maxWidth="xs" style={{ position: "relative"}}>
                    <Paper
                      style={{
                        padding: 24,
                        paddingBottom: 10,
                        backgroundColor: "rgba(21, 26, 31, 0.5)",
                        borderRadius: 6,
                      }}
                    >
                      <h6 style={{textAlign:'center'}}>Please Connect your wallet</h6>
                      <ModalClose onClick={ props.onClose }>
                        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" style={{marginTop:'5px'}} xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </ModalClose>
                    </Paper>
                  </Container>
                </Container>
            </>
          )
        }
      </>
    )
  }

  return (
    <>
      <ConnectButton disabled={!props.visibility} style={{cursor: props.visibility ? 'none' : ''}}>Connected...</ConnectButton>
    {
    props.visibility && (
      <>
      <div onClick={ props.onClose } style={{position:'fixed', left:0, top: 0, width: '100vw', height:'100vh'}}></div>
      <Container style={{ maxWidth: '500px', position: 'fixed', left:'50%', top: '50vh', transform: 'translate(-50%, -50%)'}}>
        <Container maxWidth="xs" style={{ position: "relative"}}>
          <Paper
            style={{
              padding: 24,
              paddingBottom: 10,
              backgroundColor: "rgba(21, 26, 31, 0.5)",
              borderRadius: 6,
            }}
          >
            {candyMachine && (
              <>
              <ModalHeader>
                <ModalTitle >Collect YOUR NFT before end</ModalTitle>
                <ModalClose onClick={ props.onClose }>
                  <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" style={{marginTop:'5px'}} xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </ModalClose>
              </ModalHeader>
              <div style={{textAlign:'center'}}>
                <ModalNft src={PowerGif} style={{borderRadius:'50%'}} alt="This will display an animated GIF"></ModalNft>
              </div>
              <ModalItem>
                <Typography variant="h6" color="textSecondary" >
                  Remaining
                </Typography>
                <Typography
                  variant="h6"
                  color="textPrimary"
                  style={{
                    fontWeight: "bold",marginLeft:'auto'
                  }}
                >
                  {`${itemsRemaining}`} / 8
                </Typography>
              </ModalItem>
              <ModalItem>
                <Typography variant="h6" color="textSecondary">
                    {isWhitelistUser && discountPrice
                      ? "Discount Price"
                      : "Price"}
                  </Typography>
                <Typography
                  variant="h6"
                  color="textPrimary"
                  style={{ fontWeight: "bold" , marginLeft:'auto'}}
                >
                  {isWhitelistUser && discountPrice
                    ? `◎ ${formatNumber.asNumber(discountPrice)}`
                    : `◎ ${formatNumber.asNumber(
                        candyMachine.state.price
                      )}`}
                </Typography>
              </ModalItem>
              <ModalItem>
                  <Typography
                  variant="h6"
                  color="textSecondary"
                  style={{margin:'auto 0'}}
                >
                  Status
                  </Typography>
                {isActive && endDate && Date.now() < endDate.getTime() ? (
                  <div style={{marginLeft:'auto'}}>
                    <MintCountdown
                      key="endSettings"
                      date={getCountdownDate(candyMachine)}
                      style={{ justifyContent: "flex-end" }}
                      status="COMPLETED"
                      onComplete={toggleMintButton}
                    />
                    <Typography
                      variant="caption"
                      align="center"
                      display="block"
                      style={{ fontWeight: "bold" }}
                    >
                      TO END OF MINT
                    </Typography>
                  </div>
                ) : (
                  <div style={{marginLeft:'auto'}}>
                    <MintCountdown
                      key="goLive"
                      date={getCountdownDate(candyMachine)}
                      style={{ justifyContent: "flex-end" }}
                      status={
                        candyMachine?.state?.isSoldOut ||
                        (endDate && Date.now() > endDate.getTime())
                          ? "COMPLETED"
                          : isPresale
                          ? "PRESALE"
                          : "LIVE"
                      }
                      onComplete={toggleMintButton}
                    />
                    {isPresale &&
                      candyMachine.state.goLiveDate &&
                      candyMachine.state.goLiveDate.toNumber() >
                        new Date().getTime() / 1000 && (
                        <Typography
                          variant="caption"
                          align="center"
                          display="block"
                          style={{ fontWeight: "bold" }}
                        >
                          UNTIL PUBLIC MINT
                        </Typography>
                      )}
                  </div>
                )}
              </ModalItem>
              </>
            )}
            <MintContainer>
              {candyMachine?.state.isActive &&
              candyMachine?.state.gatekeeper &&
              wallet.publicKey &&
              wallet.signTransaction ? (
                <GatewayProvider
                  wallet={{
                    publicKey:
                      wallet.publicKey ||
                      new PublicKey(CANDY_MACHINE_PROGRAM),
                    //@ts-ignore
                    signTransaction: wallet.signTransaction,
                  }}
                  gatekeeperNetwork={
                    candyMachine?.state?.gatekeeper?.gatekeeperNetwork
                  }
                  clusterUrl={rpcUrl}
                  cluster={cluster}
                  options={{ autoShowModal: false }}
                >
                  <MintButton
                    candyMachine={candyMachine}
                    isMinting={isUserMinting}
                    setIsMinting={(val) => setIsUserMinting(val)}
                    onMint={onMint}
                    isActive={
                      isActive ||
                      (isPresale && isWhitelistUser && isValidBalance)
                    }
                  />
                </GatewayProvider>
              ) : (
                <MintButton
                  candyMachine={candyMachine}
                  isMinting={isUserMinting}
                  setIsMinting={(val) => setIsUserMinting(val)}
                  onMint={onMint}
                  isActive={
                    isActive ||
                    (isPresale && isWhitelistUser && isValidBalance)
                  }
                />
              )}
            </MintContainer>
            <Typography
              variant="caption"
              align="center"
              display="block"
              style={{ marginTop: 7, color: "grey" }}
            >
              Powered by power-j
            </Typography>
          </Paper>
        </Container>

        <Snackbar
          open={alertState.open}
          autoHideDuration={
            alertState.hideDuration === undefined ? 6000 : alertState.hideDuration
          }
          onClose={() => setAlertState({ ...alertState, open: false })}
          style={{bottom:'-14vh'}}
        >
          <Alert
            onClose={() => setAlertState({ ...alertState, open: false })}
            severity={alertState.severity}
            style={{marginBottom:'300px !important'}}
          >
            {alertState.message}
          </Alert>
        </Snackbar>
      </Container>
      </>
    )}
    </>
  );
};

const getCountdownDate = (
  candyMachine: CandyMachineAccount
): Date | undefined => {
  if (
    candyMachine.state.isActive &&
    candyMachine.state.endSettings?.endSettingType.date
  ) {
    return toDate(candyMachine.state.endSettings.number);
  }

  return toDate(
    candyMachine.state.goLiveDate
      ? candyMachine.state.goLiveDate
      : candyMachine.state.isPresale
      ? new anchor.BN(new Date().getTime() / 1000)
      : undefined
  );
};

export default Minting;
