document.addEventListener("DOMContentLoaded", async () => {

  const PROJECT_ID = "c7bb3a991b675f05777c830bac0f18de";
  const ARC_CHAIN_ID = 5042;

  const CONTRACT_ADDRESS =
    "0x5E13b82A35Ac827b368215141F4a4F8ADfb1F434";

  const ARC_NETWORK = {
    id: ARC_CHAIN_ID,
    name: "Arc Mainnet",
    nativeCurrency: {
      name: "USDC",
      symbol: "USDC",
      decimals: 6
    },
    rpcUrls: {
      default: {
        http: ["https://rpc.arc.network"]
      }
    },
    blockExplorers: {
      default: {
        name: "Arc Explorer",
        url: "https://explorer.arc.io"
      }
    }
  };

  const CONTRACT_ABI = [
    "function automationCount() view returns (uint256)",
    "function createAutomation(string,address,uint256,uint256,uint256,string)",
    "function getAutomation(uint256) view returns (uint256,string,address,address,uint256,uint256,uint256,string,bool)",
    "function setAutomationStatus(uint256,bool)"
  ];

  const buttons = Array.from(document.querySelectorAll("button"));

  const connectButton = buttons.find(
    button =>
      button.textContent.trim().toLowerCase() === "connect wallet"
  );

  const createButton = buttons.find(
    button =>
      button.textContent.trim().toLowerCase() === "create automation"
  );

  const automationCountElement =
    document.getElementById("automation-count");

  const automationList =
    document.getElementById("automation-list");

  const automationStatus =
    document.getElementById("automation-status");


  /* =====================================================
     LOAD LIBRARIES
  ====================================================== */

  const { createAppKit } =
    await import("https://esm.sh/@reown/appkit");

  const { EthersAdapter } =
    await import("https://esm.sh/@reown/appkit-adapter-ethers");

  const { defineChain } =
    await import("https://esm.sh/@reown/appkit/networks");

  const ethers =
    await import("https://esm.sh/ethers@6.15.0");


  /* =====================================================
     APPKIT
  ====================================================== */

  const arc = defineChain(ARC_NETWORK);

  const adapter = new EthersAdapter();

  const modal = createAppKit({
    adapters: [adapter],
    networks: [arc],
    defaultNetwork: arc,
    projectId: PROJECT_ID,

    metadata: {
      name: "AskirawaFi",
      description: "Programmable USDC Treasury built on Arc",
      url: window.location.origin,
      icons: []
    },

    features: {
      analytics: true
    },

    allWallets: "SHOW",
    enableWallets: true,
    enableNetworkSwitch: true,
    enableReconnect: true
  });


  /* =====================================================
     WALLET BUTTON
  ====================================================== */

  function updateWalletButton(address) {

    if (!connectButton) return;

    if (address) {

      connectButton.textContent =
        `${address.slice(0, 6)}...${address.slice(-4)}`;

      connectButton.disabled = false;
      connectButton.classList.add("wallet-connected");

    } else {

      connectButton.textContent =
        "Connect Wallet";

      connectButton.disabled = false;
      connectButton.classList.remove("wallet-connected");
    }
  }


  /* =====================================================
     LOAD AUTOMATIONS
  ====================================================== */

  async function loadAutomations(address) {

    if (!automationList) return;

    if (!address) {

      if (automationStatus) {
        automationStatus.textContent =
          "Connect your Arc wallet to load your on-chain automations.";
      }

      automationList.innerHTML = `
        <div class="payment-item">
          <div>
            <span class="label">AUTOMATIONS</span>
            <strong>Connect your wallet</strong>
            <p>
              Your Arc automations will appear here after your wallet is connected.
            </p>
          </div>
        </div>
      `;

      return;
    }


    try {

      if (automationStatus) {
        automationStatus.textContent =
          "Loading your on-chain automations...";
      }

      const provider =
        new ethers.JsonRpcProvider(
          "https://rpc.arc.network"
        );

      const contract =
        new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          provider
        );

      const total =
        await contract.automationCount();

      const totalNumber =
        Number(total);

      const userAutomations = [];


      for (let id = 1; id <= totalNumber; id++) {

        const automation =
          await contract.getAutomation(id);

        const owner =
          automation[2];

        if (
          owner &&
          owner.toLowerCase() ===
          address.toLowerCase()
        ) {

          userAutomations.push({
            id: Number(automation[0]),
            name: automation[1],
            recipient: automation[3],
            amount: automation[4],
            frequency: Number(automation[5]),
            executionTime: Number(automation[6]),
            note: automation[7],
            active: automation[8]
          });
        }
      }


      if (automationCountElement) {
        automationCountElement.textContent =
          userAutomations.length;
      }


      if (userAutomations.length === 0) {

        if (automationStatus) {
          automationStatus.textContent =
            "No automations found for this wallet.";
        }

        automationList.innerHTML = `
          <div class="payment-item">
            <div>
              <span class="label">AUTOMATIONS</span>
              <strong>No automations yet</strong>
              <p>
                Create your first automation above.
              </p>
            </div>
          </div>
        `;

        return;
      }


      if (automationStatus) {
        automationStatus.textContent =
          `${userAutomations.length} automation(s) found on Arc.`;
      }


      automationList.innerHTML =
        userAutomations.map(item => {

          const amount =
            ethers.formatUnits(item.amount, 6);

          let frequency = "Once";

          if (item.frequency === 86400)
            frequency = "Daily";

          if (item.frequency === 604800)
            frequency = "Weekly";

          if (item.frequency === 2592000)
            frequency = "Monthly";

          const execution =
            new Date(
              item.executionTime * 1000
            ).toLocaleString();

          return `
            <div class="payment-item">

              <div>

                <span class="label">
                  AUTOMATION #${item.id}
                </span>

                <strong>
                  ${escapeHtml(item.name)}
                </strong>

                <p>
                  ${amount} USDC
                </p>

                <p>
                  Recipient: ${item.recipient}
                </p>

                <p>
                  Frequency: ${frequency}
                </p>

                <p>
                  First execution: ${execution}
                </p>

                ${
                  item.note
                    ? `<p>${escapeHtml(item.note)}</p>`
                    : ""
                }

              </div>

              <div>

                <span class="label">
                  STATUS
                </span>

                <strong>
                  ${item.active ? "Active" : "Paused"}
                </strong>

              </div>

            </div>
          `;

        }).join("");


    } catch (error) {

      console.error(
        "Automation loading error:",
        error
      );

      if (automationStatus) {
        automationStatus.textContent =
          "Unable to load automations.";
      }
    }
  }


  /* =====================================================
     HTML SAFETY
  ====================================================== */

  function escapeHtml(value) {

    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  /* =====================================================
     CHECK WALLET DIRECTLY
  ====================================================== */

  async function checkWallet() {

    try {

      const connected =
        modal.getIsConnected();

      const address =
        modal.getAddress();

      console.log(
        "Wallet connected:",
        connected
      );

      console.log(
        "Wallet address:",
        address
      );


      if (connected && address) {

        updateWalletButton(address);

        await loadAutomations(address);

      } else {

        updateWalletButton(null);

        await loadAutomations(null);
      }

    } catch (error) {

      console.error(
        "Wallet state error:",
        error
      );
    }
  }


  /* =====================================================
     WATCH WALLET CHANGES
  ====================================================== */

  modal.subscribeState(
    async () => {
      await checkWallet();
    }
  );


  /* =====================================================
     CONNECT BUTTON
  ====================================================== */

  if (connectButton) {

    connectButton.addEventListener(
      "click",
      async () => {

        try {

          connectButton.disabled = true;
          connectButton.textContent = "Connecting...";

          await modal.open({
            view: "Connect"
          });

        } catch (error) {

          console.error(
            "Wallet connection error:",
            error
          );

          connectButton.textContent =
            "Connect Wallet";

          connectButton.disabled = false;
        }
      }
    );
  }


  /* =====================================================
     INITIAL WALLET CHECK
  ====================================================== */

  await checkWallet();


  /* =====================================================
     CREATE AUTOMATION
  ====================================================== */

  if (createButton) {

    createButton.addEventListener(
      "click",
      async (event) => {

        event.preventDefault();

        try {

          const connected =
            modal.getIsConnected();

          const address =
            modal.getAddress();

          if (!connected || !address) {

            alert(
              "Please connect your Arc wallet first."
            );

            await modal.open({
              view: "Connect"
            });

            return;
          }


          const name =
            document
              .getElementById("automation-name")
              .value.trim();

          const recipient =
            document
              .getElementById("automation-recipient")
              .value.trim();

          const amount =
            document
              .getElementById("automation-amount")
              .value.trim();

          const frequency =
            document
              .getElementById("automation-frequency")
              .value;

          const date =
            document
              .getElementById("automation-date")
              .value;

          const note =
            document
              .getElementById("automation-note")
              .value.trim();


          if (!name) {
            alert("Enter an automation name.");
            return;
          }

          if (!ethers.isAddress(recipient)) {
            alert("Enter a valid recipient wallet address.");
            return;
          }

          if (!amount || Number(amount) <= 0) {
            alert("Enter a valid USDC amount.");
            return;
          }

          if (!date) {
            alert("Select an execution date.");
            return;
          }


          const executionTime =
            Math.floor(
              new Date(date).getTime() / 1000
            );


          if (
            executionTime <=
            Math.floor(Date.now() / 1000)
          ) {

            alert(
              "Execution time must be in the future."
            );

            return;
          }


          let frequencySeconds = 0;

          if (frequency === "Daily")
            frequencySeconds = 86400;

          if (frequency === "Weekly")
            frequencySeconds = 604800;

          if (frequency === "Monthly")
            frequencySeconds = 2592000;


          const walletProvider =
            await modal.getWalletProvider();

          const browserProvider =
            new ethers.BrowserProvider(
              walletProvider
            );

          const network =
            await browserProvider.getNetwork();


          if (
            Number(network.chainId) !==
            ARC_CHAIN_ID
          ) {

            alert(
              "Please switch your wallet to Arc Mainnet."
            );

            return;
          }


          const signer =
            await browserProvider.getSigner();

          const contract =
            new ethers.Contract(
              CONTRACT_ADDRESS,
              CONTRACT_ABI,
              signer
            );


          const parsedAmount =
            ethers.parseUnits(
              amount,
              6
            );


          const transaction =
            await contract.createAutomation(
              name,
              recipient,
              parsedAmount,
              frequencySeconds,
              executionTime,
              note
            );


          await transaction.wait();


          alert(
            "Automation created successfully on Arc."
          );


          document
            .getElementById("automationForm")
            ?.reset();


          await loadAutomations(address);

        } catch (error) {

          console.error(
            "Create automation error:",
            error
          );

          alert(
            error?.shortMessage ||
            error?.reason ||
            "Unable to create automation."
          );
        }
      }
    );
  }

});
