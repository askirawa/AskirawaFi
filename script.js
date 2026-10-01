document.addEventListener("DOMContentLoaded", async () => {
  // =========================================================
  // ASKIRAWAFI CONFIG
  // =========================================================

  const PROJECT_ID = "c7bb3a991b675f05777c830bac0f18de";

  const ARC_CHAIN_ID = 5042;

  const AUTOMATION_CONTRACT =
    "0x5E13b82A35Ac827b368215141F4a4F8ADfb1F434";

  const AUTOMATION_ABI = [
    "function automationCount() view returns (uint256)",

    "function createAutomation(string name,address recipient,uint256 amount,uint256 frequency,uint256 executionTime,string note)",

    "function getAutomation(uint256 id) view returns (uint256,string,address,address,uint256,uint256,uint256,string,bool)",

    "function setAutomationStatus(uint256 id,bool active)"
  ];

  const ARC_NETWORK = {
    id: ARC_CHAIN_ID,
    name: "Arc Mainnet",

    nativeCurrency: {
      name: "USDC",
      symbol: "USDC",
      decimals: 6,
    },

    rpcUrls: {
      default: {
        http: ["https://rpc.arc.network"],
      },
    },

    blockExplorers: {
      default: {
        name: "Arc Explorer",
        url: "https://explorer.arc.io",
      },
    },
  };


  // =========================================================
  // FIND WALLET BUTTON
  // =========================================================

  const buttons = Array.from(document.querySelectorAll("button"));

  const connectButton = buttons.find(
    (button) =>
      button.textContent.trim().toLowerCase() === "connect wallet"
  );

  if (!connectButton) {
    console.error("Connect Wallet button not found.");
    return;
  }


  // =========================================================
  // VARIABLES
  // =========================================================

  let modal = null;
  let walletProvider = null;
  let ethersProvider = null;
  let signer = null;
  let automationContract = null;


  // =========================================================
  // LOAD APPKIT
  // =========================================================

  async function loadAppKit() {
    if (modal) return modal;

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
        icons: [],
      },

      features: {
        analytics: true,
      },

      allWallets: "SHOW",

      enableWallets: true,

      enableNetworkSwitch: true,

      enableReconnect: true,
    });

    // Listen for wallet changes
    modal.subscribeState((state) => {
      if (state.isConnected && state.address) {
        const address = state.address;

        connectButton.textContent =
          `${address.slice(0, 6)}...${address.slice(-4)}`;

        connectButton.disabled = false;
        connectButton.classList.add("wallet-connected");

        console.log("Wallet connected:", address);
      } else {
        connectButton.textContent = "Connect Wallet";
        connectButton.disabled = false;
        connectButton.classList.remove("wallet-connected");

        walletProvider = null;
        ethersProvider = null;
        signer = null;
        automationContract = null;
      }
    });

    return modal;
  }


  // =========================================================
  // CONNECT WALLET
  // =========================================================

  connectButton.addEventListener("click", async () => {
    try {
      connectButton.disabled = true;
      connectButton.textContent = "Connecting...";

      const appKit = await loadAppKit();

      await appKit.open({
        view: "Connect",
      });

    } catch (error) {
      console.error("Wallet connection error:", error);

      connectButton.textContent = "Connect Wallet";
      connectButton.disabled = false;

      alert(
        "Unable to open the wallet connection window. Please try again."
      );
    }
  });


  // =========================================================
  // CREATE ETHERS CONTRACT CONNECTION
  // =========================================================

  async function setupContract() {
    try {
      if (!modal) {
        await loadAppKit();
      }

      if (!modal.getWalletProvider) {
        throw new Error(
          "Wallet provider is not available yet."
        );
      }

      walletProvider = await modal.getWalletProvider();

      if (!walletProvider) {
        throw new Error(
          "Please connect your wallet first."
        );
      }

      // Load ethers
      const ethers = await import(
        "https://esm.sh/ethers@6.15.0"
      );

      ethersProvider = new ethers.BrowserProvider(
        walletProvider
      );

      signer = await ethersProvider.getSigner();

      const network = await ethersProvider.getNetwork();

      if (Number(network.chainId) !== ARC_CHAIN_ID) {
        throw new Error(
          "Please switch your wallet to Arc Mainnet."
        );
      }

      automationContract = new ethers.Contract(
        AUTOMATION_CONTRACT,
        AUTOMATION_ABI,
        signer
      );

      return {
        ethers,
        contract: automationContract,
        signer,
      };

    } catch (error) {
      console.error(
        "Contract connection error:",
        error
      );

      throw error;
    }
  }


  // =========================================================
  // GET AUTOMATION COUNT
  // =========================================================

  async function updateAutomationCount() {
    try {
      if (!modal) return;

      const state = modal.getState();

      if (!state || !state.isConnected) return;

      const connection = await setupContract();

      const count =
        await connection.contract.automationCount();

      const countElement =
        document.getElementById("automation-count");

      if (countElement) {
        countElement.textContent =
          count.toString();
      }

    } catch (error) {
      console.error(
        "Unable to read automation count:",
        error
      );
    }
  }


  // =========================================================
  // FREQUENCY
  // =========================================================

  function getFrequencyValue(value) {
    switch (value.toLowerCase()) {
      case "daily":
        return 86400;

      case "weekly":
        return 604800;

      case "monthly":
        return 2592000;

      case "once":
      default:
        return 0;
    }
  }


  // =========================================================
  // CREATE AUTOMATION
  // =========================================================

  async function createAutomation() {
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


      if (
        !nameInput ||
        !recipientInput ||
        !amountInput ||
        !frequencyInput ||
        !dateInput
      ) {
        alert(
          "Automation form fields could not be found."
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


      // Basic validation

      if (!name) {
        alert("Please enter an automation name.");
        return;
      }

      if (!recipient) {
        alert("Please enter a recipient address.");
        return;
      }

      if (!amount || Number(amount) <= 0) {
        alert("Please enter a valid USDC amount.");
        return;
      }

      if (!date) {
        alert("Please select an execution date.");
        return;
      }


      // Connect to contract

      const connection =
        await setupContract();

      const ethers =
        connection.ethers;

      const contract =
        connection.contract;


      // Validate Ethereum address

      if (!ethers.isAddress(recipient)) {
        alert(
          "Please enter a valid wallet address."
        );

        return;
      }


      // USDC uses 6 decimals

      const amountInUSDC =
        ethers.parseUnits(amount, 6);


      // Convert selected frequency

      const frequencyValue =
        getFrequencyValue(frequency);


      // Convert date to Unix timestamp

      const executionTimestamp =
        Math.floor(
          new Date(date).getTime() / 1000
        );


      // Make sure execution is in future

      const currentTimestamp =
        Math.floor(Date.now() / 1000);

      if (
        executionTimestamp <=
        currentTimestamp
      ) {
        alert(
          "Please select a future date and time."
        );

        return;
      }


      // Find Create Automation button

      const createButton =
        Array.from(
          document.querySelectorAll("button")
        ).find(
          (button) =>
            button.textContent
              .trim()
              .toLowerCase() ===
            "create automation"
        );


      if (createButton) {
        createButton.disabled = true;
        createButton.textContent =
          "Creating...";
      }


      console.log(
        "Creating automation on Arc..."
      );

      console.log({
        name,
        recipient,
        amount,
        frequency,
        frequencyValue,
        executionTimestamp,
        note,
      });


      // SEND TRANSACTION TO ARC

      const transaction =
        await contract.createAutomation(
          name,
          recipient,
          amountInUSDC,
          frequencyValue,
          executionTimestamp,
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


      // Wait for blockchain confirmation

      const receipt =
        await transaction.wait();


      console.log(
        "Automation confirmed:",
        receipt
      );


      alert(
        "Automation created successfully on Arc."
      );


      // Reset form

      nameInput.value = "";
      recipientInput.value = "";
      amountInput.value = "";

      if (noteInput) {
        noteInput.value = "";
      }


      // Update count

      await updateAutomationCount();


      if (createButton) {
        createButton.textContent =
          "Create Automation";

        createButton.disabled = false;
      }

    } catch (error) {
      console.error(
        "Create automation error:",
        error
      );


      let message =
        "Unable to create automation.";


      if (error && error.message) {
        if (
          error.message.includes(
            "user rejected"
          )
        ) {
          message =
            "Transaction was rejected in your wallet.";
        } else if (
          error.message.includes(
            "Execution time must be future"
          )
        ) {
          message =
            "Please select a future execution time.";
        } else if (
          error.message.includes(
            "Invalid recipient"
          )
        ) {
          message =
            "The recipient address is invalid.";
        } else if (
          error.message.includes(
            "insufficient"
          )
        ) {
          message =
            "Your wallet does not have enough USDC for the transaction.";
        }
      }


      alert(message);


      const createButton =
        Array.from(
          document.querySelectorAll("button")
        ).find(
          (button) =>
            button.textContent
              .trim()
              .toLowerCase()
              .includes("automation")
        );


      if (createButton) {
        createButton.textContent =
          "Create Automation";

        createButton.disabled = false;
      }
    }
  }


  // =========================================================
  // CONNECT CREATE AUTOMATION BUTTON
  // =========================================================

  const createAutomationButton =
    Array.from(
      document.querySelectorAll("button")
    ).find(
      (button) =>
        button.textContent
          .trim()
          .toLowerCase() ===
        "create automation"
    );


  if (createAutomationButton) {
    createAutomationButton.addEventListener(
      "click",
      async (event) => {
        event.preventDefault();

        await createAutomation();
      }
    );
  }


  // =========================================================
  // LOAD APPKIT EARLY
  // =========================================================

  try {
    await loadAppKit();

    console.log(
      "AskirawaFi wallet system ready."
    );

  } catch (error) {
    console.error(
      "AppKit initialization error:",
      error
    );
  }
});
