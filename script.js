document.addEventListener("DOMContentLoaded", async () => {
  // =========================================================
  // ASKIRAWAFI
  // =========================================================

  const PROJECT_ID = "c7bb3a991b675f05777c830bac0f18de";

  const ARC_CHAIN_ID = 5042;

  const AUTOMATION_CONTRACT =
    "0x5E13b82A35Ac827b368215141F4a4F8ADfb1F434";

  const AUTOMATION_ABI = [
    "function automationCount() view returns (uint256)",

    "function createAutomation(string,address,uint256,uint256,uint256,string)",

    "function getAutomation(uint256) view returns (uint256,string,address,address,uint256,uint256,uint256,string,bool)",

    "function setAutomationStatus(uint256,bool)"
  ];

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


  // =========================================================
  // FIND BUTTONS
  // =========================================================

  const buttons = Array.from(
    document.querySelectorAll("button")
  );

  const connectButton = buttons.find(
    (button) =>
      button.textContent.trim().toLowerCase() ===
      "connect wallet"
  );

  const createButton = buttons.find(
    (button) =>
      button.textContent.trim().toLowerCase() ===
      "create automation"
  );

  if (!connectButton) {
    console.error(
      "AskirawaFi: Connect Wallet button not found."
    );

    return;
  }


  // =========================================================
  // VARIABLES
  // =========================================================

  let modal = null;
  let ethers = null;
  let provider = null;
  let signer = null;
  let contract = null;


  // =========================================================
  // LOAD ETHERS
  // =========================================================

  async function loadEthers() {
    if (!ethers) {
      ethers = await import(
        "https://esm.sh/ethers@6.15.0"
      );
    }

    return ethers;
  }


  // =========================================================
  // INITIALIZE APPKIT
  // =========================================================

  async function initializeAppKit() {
    if (modal) {
      return modal;
    }

    const { createAppKit } = await import(
      "https://esm.sh/@reown/appkit"
    );

    const { EthersAdapter } = await import(
      "https://esm.sh/@reown/appkit-adapter-ethers"
    );

    const { defineChain } = await import(
      "https://esm.sh/@reown/appkit/networks"
    );

    const arc = defineChain(ARC_NETWORK);

    const adapter = new EthersAdapter();

    modal = createAppKit({
      adapters: [adapter],

      networks: [arc],

      defaultNetwork: arc,

      projectId: PROJECT_ID,

      metadata: {
        name: "AskirawaFi",

        description:
          "Programmable USDC Treasury built on Arc",

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

    console.log(
      "AskirawaFi AppKit initialized."
    );

    return modal;
  }


  // =========================================================
  // UPDATE WALLET DISPLAY
  // =========================================================

  function displayWalletAddress(address) {
    if (!address) {
      return;
    }

    connectButton.textContent =
      `${address.slice(0, 6)}...${address.slice(-4)}`;

    connectButton.disabled = false;

    connectButton.classList.add(
      "wallet-connected"
    );

    console.log(
      "AskirawaFi wallet:",
      address
    );
  }


  // =========================================================
  // CONNECT WALLET
  // =========================================================

  connectButton.addEventListener(
    "click",
    async () => {
      try {
        connectButton.disabled = true;

        connectButton.textContent =
          "Connecting...";

        const appKit =
          await initializeAppKit();

        await appKit.open({
          view: "Connect"
        });

        console.log(
          "Wallet interface opened."
        );

      } catch (error) {
        console.error(
          "Wallet connection error:",
          error
        );

        connectButton.textContent =
          "Connect Wallet";

        connectButton.disabled = false;

        alert(
          "Unable to open the wallet connection window."
        );
      }
    }
  );


  // =========================================================
  // GET WALLET CONNECTION
  // =========================================================

  async function getWalletConnection() {
    const appKit =
      await initializeAppKit();

    /*
     * AppKit's wallet provider gives us access
     * to the connected EVM wallet.
     */

    let walletProvider = null;

    if (
      typeof appKit.getWalletProvider ===
      "function"
    ) {
      walletProvider =
        await appKit.getWalletProvider();
    }

    if (!walletProvider) {
      throw new Error(
        "Please connect your wallet first."
      );
    }

    const loadedEthers =
      await loadEthers();

    provider =
      new loadedEthers.BrowserProvider(
        walletProvider
      );

    signer =
      await provider.getSigner();

    const network =
      await provider.getNetwork();

    if (
      Number(network.chainId) !==
      ARC_CHAIN_ID
    ) {
      throw new Error(
        "Please switch your wallet to Arc Mainnet."
      );
    }

    contract =
      new loadedEthers.Contract(
        AUTOMATION_CONTRACT,
        AUTOMATION_ABI,
        signer
      );

    const address =
      await signer.getAddress();

    displayWalletAddress(address);

    return {
      provider,
      signer,
      contract,
      address,
      ethers: loadedEthers
    };
  }


  // =========================================================
  // AUTOMATION COUNT
  // =========================================================

  async function loadAutomationCount() {
    try {
      const connection =
        await getWalletConnection();

      const count =
        await connection.contract
          .automationCount();

      const countElement =
        document.getElementById(
          "automation-count"
        );

      if (countElement) {
        countElement.textContent =
          count.toString();
      }

      console.log(
        "Automation count:",
        count.toString()
      );

    } catch (error) {
      console.log(
        "Automation count not loaded:",
        error.message
      );
    }
  }


  // =========================================================
  // FREQUENCY
  // =========================================================

  function frequencyToSeconds(
    frequency
  ) {
    const value =
      frequency.toLowerCase();

    if (value === "daily") {
      return 86400;
    }

    if (value === "weekly") {
      return 604800;
    }

    if (value === "monthly") {
      return 2592000;
    }

    return 0;
  }


  // =========================================================
  // CREATE AUTOMATION
  // =========================================================

  async function handleCreateAutomation() {
    try {
      const nameInput =
        document.getElementById(
          "automation-name"
        );

      const recipientInput =
        document.getElementById(
          "automation-recipient"
        );

      const amountInput =
        document.getElementById(
          "automation-amount"
        );

      const frequencyInput =
        document.getElementById(
          "automation-frequency"
        );

      const dateInput =
        document.getElementById(
          "automation-date"
        );

      const noteInput =
        document.getElementById(
          "automation-note"
        );


      // -----------------------------------------
      // CHECK FORM
      // -----------------------------------------

      if (
        !nameInput ||
        !recipientInput ||
        !amountInput ||
        !frequencyInput ||
        !dateInput
      ) {
        alert(
          "Automation form could not be found."
        );

        return;
      }


      const name =
        nameInput.value.trim();

      const recipient =
        recipientInput.value.trim();

      const amount =
        amountInput.value.trim();

      const frequency =
        frequencyInput.value;

      const date =
        dateInput.value;

      const note =
        noteInput
          ? noteInput.value.trim()
          : "";


      if (!name) {
        alert(
          "Enter an automation name."
        );

        return;
      }


      if (!recipient) {
        alert(
          "Enter a recipient wallet address."
        );

        return;
      }


      if (!amount || Number(amount) <= 0) {
        alert(
          "Enter a valid USDC amount."
        );

        return;
      }


      if (!date) {
        alert(
          "Select an execution date and time."
        );

        return;
      }


      // -----------------------------------------
      // CONNECT TO ARC
      // -----------------------------------------

      if (createButton) {
        createButton.disabled = true;

        createButton.textContent =
          "Connecting...";
      }


      const connection =
        await getWalletConnection();


      // -----------------------------------------
      // VALIDATE ADDRESS
      // -----------------------------------------

      if (
        !connection.ethers.isAddress(
          recipient
        )
      ) {
        throw new Error(
          "Invalid recipient wallet address."
        );
      }


      // -----------------------------------------
      // USDC = 6 DECIMALS
      // -----------------------------------------

      const amountInUSDC =
        connection.ethers.parseUnits(
          amount,
          6
        );


      // -----------------------------------------
      // FREQUENCY
      // -----------------------------------------

      const frequencyValue =
        frequencyToSeconds(
          frequency
        );


      // -----------------------------------------
      // EXECUTION TIME
      // -----------------------------------------

      const executionTime =
        Math.floor(
          new Date(date).getTime() /
          1000
        );

      const now =
        Math.floor(
          Date.now() / 1000
        );

      if (
        executionTime <= now
      ) {
        throw new Error(
          "Execution time must be in the future."
        );
      }


      // -----------------------------------------
      // SEND TRANSACTION
      // -----------------------------------------

      if (createButton) {
        createButton.textContent =
          "Confirm in Wallet...";
      }

      console.log(
        "Sending automation transaction..."
      );

      const transaction =
        await connection.contract
          .createAutomation(
            name,
            recipient,
            amountInUSDC,
            frequencyValue,
            executionTime,
            note
          );


      console.log(
        "Transaction submitted:",
        transaction.hash
      );


      if (createButton) {
        createButton.textContent =
          "Confirming...";
      }


      // -----------------------------------------
      // WAIT FOR ARC
      // -----------------------------------------

      const receipt =
        await transaction.wait();


      console.log(
        "Automation confirmed on Arc:",
        receipt.hash
      );


      // -----------------------------------------
      // UPDATE COUNT
      // -----------------------------------------

      const count =
        await connection.contract
          .automationCount();

      const countElement =
        document.getElementById(
          "automation-count"
        );

      if (countElement) {
        countElement.textContent =
          count.toString();
      }


      // -----------------------------------------
      // SUCCESS
      // -----------------------------------------

      alert(
        "Automation created successfully on Arc."
      );


      // -----------------------------------------
      // RESET FORM
      // -----------------------------------------

      nameInput.value = "";
      recipientInput.value = "";
      amountInput.value = "";

      if (noteInput) {
        noteInput.value = "";
      }


      if (createButton) {
        createButton.textContent =
          "Create Automation";

        createButton.disabled = false;
      }


      console.log(
        "Arc transaction:",
        `https://explorer.arc.io/tx/${receipt.hash}`
      );

    } catch (error) {
      console.error(
        "Automation error:",
        error
      );


      let message =
        "Unable to create automation.";


      if (error.message) {
        if (
          error.message
            .toLowerCase()
            .includes("user rejected")
        ) {
          message =
            "Transaction rejected in your wallet.";
        }

        else if (
          error.message
            .toLowerCase()
            .includes("invalid recipient")
        ) {
          message =
            "The recipient wallet address is invalid.";
        }

        else if (
          error.message
            .toLowerCase()
            .includes("future")
        ) {
          message =
            "Please choose a future execution time.";
        }

        else if (
          error.message
            .toLowerCase()
            .includes("arc mainnet")
        ) {
          message =
            "Please switch your wallet to Arc Mainnet.";
        }

        else if (
          error.message
            .toLowerCase()
            .includes("connect your wallet")
        ) {
          message =
            "Please connect your wallet first.";
        }
      }


      alert(message);


      if (createButton) {
        createButton.textContent =
          "Create Automation";

        createButton.disabled = false;
      }
    }
  }


  // =========================================================
  // CREATE AUTOMATION BUTTON
  // =========================================================

  if (createButton) {
    createButton.addEventListener(
      "click",
      async (event) => {
        event.preventDefault();

        await handleCreateAutomation();
      }
    );

    console.log(
      "Create Automation button ready."
    );
  } else {
    console.warn(
      "Create Automation button not found."
    );
  }


  // =========================================================
  // START
  // =========================================================

  try {
    await initializeAppKit();

    console.log(
      "AskirawaFi is ready."
    );

  } catch (error) {
    console.error(
      "AskirawaFi initialization error:",
      error
    );
  }
});
