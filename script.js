document.addEventListener("DOMContentLoaded", async () => {

  const PROJECT_ID =
    "c7bb3a991b675f05777c830bac0f18de";

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


  const connectButton =
    document.getElementById("connect-wallet");


  if (!connectButton) {
    console.error("Connect Wallet button not found.");
    return;
  }


  let modal = null;

  let walletProvider = null;

  let ethersProvider = null;

  let signer = null;

  let automationContract = null;


  /* =========================================
     LOAD APPKIT
  ========================================= */

  async function loadAppKit() {

    if (modal) {
      return modal;
    }


    const { createAppKit } =
      await import(
        "https://esm.sh/@reown/appkit"
      );


    const { EthersAdapter } =
      await import(
        "https://esm.sh/@reown/appkit-adapter-ethers"
      );


    const { defineChain } =
      await import(
        "https://esm.sh/@reown/appkit/networks"
      );


    const arc =
      defineChain(ARC_NETWORK);


    const adapter =
      new EthersAdapter();


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


    /*
     * AppKit state listener
     */

    modal.subscribeState(
      async (state) => {

        console.log(
          "AppKit state:",
          state
        );


        if (
          state.isConnected &&
          state.address
        ) {

          const address =
            state.address;


          connectButton.textContent =
            `${address.slice(0, 6)}...${address.slice(-4)}`;


          connectButton.disabled = false;


          connectButton.classList.add(
            "wallet-connected"
          );


          console.log(
            "Wallet connected:",
            address
          );


          /*
           * IMPORTANT:
           * Wait a moment for AppKit
           * provider to become available.
           */

          setTimeout(
            async () => {

              try {

                await loadRealAutomations();

              } catch (error) {

                console.error(
                  "Automation loading failed:",
                  error
                );

              }

            },
            500
          );

        } else {

          connectButton.textContent =
            "Connect Wallet";

          connectButton.disabled =
            false;

          connectButton.classList.remove(
            "wallet-connected"
          );


          walletProvider = null;

          ethersProvider = null;

          signer = null;

          automationContract = null;


          const countElement =
            document.getElementById(
              "automation-count"
            );


          if (countElement) {
            countElement.textContent = "0";
          }

        }

      }
    );


    return modal;

  }


  /* =========================================
     CONNECT WALLET
  ========================================= */

  connectButton.addEventListener(
    "click",
    async () => {

      try {

        connectButton.disabled =
          true;

        connectButton.textContent =
          "Connecting...";


        const appKit =
          await loadAppKit();


        await appKit.open({
          view: "Connect"
        });


      } catch (error) {

        console.error(
          "Wallet connection error:",
          error
        );


        connectButton.textContent =
          "Connect Wallet";

        connectButton.disabled =
          false;


        alert(
          "Unable to open the wallet connection window."
        );

      }

    }
  );


  /* =========================================
     GET WALLET PROVIDER
  ========================================= */

  async function getWalletProvider() {

    if (!modal) {
      await loadAppKit();
    }


    /*
     * AppKit exposes the connected
     * wallet provider through getWalletProvider.
     */

    if (
      typeof modal.getWalletProvider ===
      "function"
    ) {

      const provider =
        await modal.getWalletProvider();


      if (provider) {

        console.log(
          "AppKit wallet provider found."
        );

        return provider;

      }

    }


    /*
     * Fallback for injected wallets.
     */

    if (
      window.ethereum &&
      typeof window.ethereum.request ===
      "function"
    ) {

      console.log(
        "Using injected wallet provider."
      );

      return window.ethereum;

    }


    throw new Error(
      "Wallet provider is not available."
    );

  }


  /* =========================================
     SETUP ETHERS + CONTRACT
  ========================================= */

  async function setupContract() {

    const ethers =
      await import(
        "https://esm.sh/ethers@6.15.0"
      );


    walletProvider =
      await getWalletProvider();


    if (!walletProvider) {

      throw new Error(
        "Please connect your wallet first."
      );

    }


    /*
     * Ethers v6 BrowserProvider
     * wraps the EIP-1193 provider.
     */

    ethersProvider =
      new ethers.BrowserProvider(
        walletProvider
      );


    const network =
      await ethersProvider.getNetwork();


    console.log(
      "Connected chain:",
      network.chainId.toString()
    );


    if (
      Number(network.chainId) !==
      ARC_CHAIN_ID
    ) {

      throw new Error(
        "Please switch your wallet to Arc Mainnet."
      );

    }


    signer =
      await ethersProvider.getSigner();


    const address =
      await signer.getAddress();


    console.log(
      "Signer address:",
      address
    );


    automationContract =
      new ethers.Contract(
        AUTOMATION_CONTRACT,
        AUTOMATION_ABI,
        signer
      );


    return {
      ethers,
      provider: ethersProvider,
      signer,
      contract: automationContract
    };

  }


  /* =========================================
     UPDATE AUTOMATION COUNT
  ========================================= */

  async function updateAutomationCount() {

    try {

      const connection =
        await setupContract();


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
        "On-chain automation count:",
        count.toString()
      );


      return Number(count);


    } catch (error) {

      console.error(
        "Unable to read automation count:",
        error
      );


      return 0;

    }

  }


  /* =========================================
     FIND AUTOMATION CONTAINER
  ========================================= */

  function findAutomationContainer() {

    const container =
      document.getElementById(
        "automation-list"
      );


    if (!container) {

      throw new Error(
        "automation-list element not found."
      );

    }


    return container;

  }


  /* =========================================
     FREQUENCY
  ========================================= */

  function formatFrequency(seconds) {

    const value =
      Number(seconds);


    if (value === 0) {
      return "Once";
    }


    if (value === 86400) {
      return "Daily";
    }


    if (value === 604800) {
      return "Weekly";
    }


    if (value === 2592000) {
      return "Monthly";
    }


    if (
      value % 86400 ===
      0
    ) {

      return `${value / 86400} days`;

    }


    return `${value} seconds`;

  }


  /* =========================================
     EXECUTION TIME
  ========================================= */

  function formatExecutionTime(timestamp) {

    const value =
      Number(timestamp);


    if (!value) {
      return "Not scheduled";
    }


    const date =
      new Date(
        value * 1000
      );


    return date.toLocaleString();

  }


  /* =========================================
     ESCAPE HTML
  ========================================= */

  function escapeHtml(value) {

    return String(value)

      .replace(
        /&/g,
        "&amp;"
      )

      .replace(
        /</g,
        "&lt;"
      )

      .replace(
        />/g,
        "&gt;"
      )

      .replace(
        /"/g,
        "&quot;"
      )

      .replace(
        /'/g,
        "&#039;"
      );

  }


  /* =========================================
     CREATE AUTOMATION CARD
  ========================================= */

  function createAutomationCard(
    automation
  ) {

    const card =
      document.createElement(
        "div"
      );


    card.className =
      "automation";


    const statusText =
      automation.active
        ? "Active"
        : "Paused";


    const statusColor =
      automation.active
        ? "#35d98b"
        : "#888";


    card.innerHTML = `

      <div>

        <div class="automation-name">
          ${escapeHtml(
            automation.name
          )}
        </div>

        <div class="automation-meta">
          ${escapeHtml(
            automation.note ||
            "Programmable treasury automation"
          )}
        </div>

      </div>


      <div>

        <div class="automation-small">
          Amount
        </div>

        <div class="automation-amount">
          ${automation.amount} USDC
        </div>

      </div>


      <div>

        <div class="automation-small">
          Recipient
        </div>

        <div
          style="
            font-size:12px;
            word-break:break-all;
            opacity:.8;
          "
        >
          ${automation.recipient}
        </div>

      </div>


      <div>

        <div class="automation-small">
          ${formatFrequency(
            automation.frequency
          )}
        </div>

        <div
          style="
            font-size:11px;
            color:var(--muted);
            margin-bottom:8px;
          "
        >
          Next:
          ${formatExecutionTime(
            automation.executionTime
          )}
        </div>

        <button
          class="automation-status-button"
          data-automation-id="${automation.id}"
          style="
            border:0;
            background:transparent;
            padding:0;
            color:${statusColor};
            font-size:11px;
            font-weight:600;
          "
        >
          ${statusText}
        </button>

      </div>

    `;


    const statusButton =
      card.querySelector(
        ".automation-status-button"
      );


    if (statusButton) {

      statusButton.addEventListener(
        "click",
        async () => {

          await toggleAutomation(
            automation.id,
            !automation.active
          );

        }
      );

    }


    return card;

  }


  /* =========================================
     LOAD REAL ON-CHAIN AUTOMATIONS
  ========================================= */

  async function loadRealAutomations() {

    const container =
      findAutomationContainer();


    container.innerHTML = `

      <div class="onchain-empty">
        Loading on-chain automations...
      </div>

    `;


    try {

      const connection =
        await setupContract();


      const contract =
        connection.contract;


      const ethers =
        connection.ethers;


      console.log(
        "Reading automation contract:",
        AUTOMATION_CONTRACT
      );


      const count =
        await contract.automationCount();


      const total =
        Number(count);


      console.log(
        "Automation count:",
        total
      );


      const countElement =
        document.getElementById(
          "automation-count"
        );


      if (countElement) {

        countElement.textContent =
          total.toString();

      }


      container.innerHTML = "";


      if (total === 0) {

        container.innerHTML = `

          <div class="onchain-empty">

            No on-chain automations created yet.

          </div>

        `;

        return;

      }


      for (
        let id = 0;
        id < total;
        id++
      ) {

        try {

          console.log(
            `Reading automation ${id}...`
          );


          const result =
            await contract.getAutomation(
              id
            );


          const automation = {

            id:
              result[0].toString(),

            name:
              result[1],

            owner:
              result[2],

            recipient:
              result[3],

            amount:
              ethers.formatUnits(
                result[4],
                6
              ),

            frequency:
              result[5].toString(),

            executionTime:
              result[6].toString(),

            note:
              result[7],

            active:
              result[8]

          };


          console.log(
            "Loaded automation:",
            automation
          );


          container.appendChild(
            createAutomationCard(
              automation
            )
          );


        } catch (error) {

          console.error(
            `Unable to load automation ${id}:`,
            error
          );

        }

      }


    } catch (error) {

      console.error(
        "Unable to load on-chain automations:",
        error
      );


      container.innerHTML = `

        <div class="onchain-empty">

          Unable to read your on-chain automations.

          <br><br>

          <span style="font-size:12px;">
            ${escapeHtml(
              error.message ||
              "Unknown wallet or network error."
            )}
          </span>

        </div>

      `;

    }

  }


  /* =========================================
     TOGGLE AUTOMATION
  ========================================= */

  async function toggleAutomation(
    id,
    active
  ) {

    try {

      const connection =
        await setupContract();


      const transaction =
        await connection.contract
          .setAutomationStatus(
            id,
            active
          );


      console.log(
        "Status transaction:",
        transaction.hash
      );


      await transaction.wait();


      alert(
        active
          ? "Automation activated successfully."
          : "Automation paused successfully."
      );


      await loadRealAutomations();


    } catch (error) {

      console.error(
        "Unable to change automation status:",
        error
      );


      alert(
        error.message ||
        "Unable to change automation status."
      );

    }

  }


  /* =========================================
     FREQUENCY VALUE
  ========================================= */

  function getFrequencyValue(
    value
  ) {

    switch (
      value.toLowerCase()
    ) {

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


  /* =========================================
     CREATE AUTOMATION
  ========================================= */

  async function createAutomation() {

    const form =
      document.getElementById(
        "automation-form-element"
      );


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


    if (!name) {

      alert(
        "Please enter an automation name."
      );

      return;

    }


    if (!recipient) {

      alert(
        "Please enter a recipient address."
      );

      return;

    }


    if (
      !amount ||
      Number(amount) <= 0
    ) {

      alert(
        "Please enter a valid USDC amount."
      );

      return;

    }


    if (!date) {

      alert(
        "Please select an execution date."
      );

      return;

    }


    try {

      const connection =
        await setupContract();


      const ethers =
        connection.ethers;


      const contract =
        connection.contract;


      if (
        !ethers.isAddress(
          recipient
        )
      ) {

        alert(
          "Please enter a valid wallet address."
        );

        return;

      }


      const amountInUSDC =
        ethers.parseUnits(
          amount,
          6
        );


      const frequencyValue =
        getFrequencyValue(
          frequency
        );


      const executionTimestamp =
        Math.floor(
          new Date(
            date
          ).getTime() / 1000
        );


      const currentTimestamp =
        Math.floor(
          Date.now() / 1000
        );


      if (
        executionTimestamp <=
        currentTimestamp
      ) {

        alert(
          "Please select a future execution date."
        );

        return;

      }


      const submitButton =
        form.querySelector(
          'button[type="submit"]'
        );


      if (submitButton) {

        submitButton.disabled =
          true;

        submitButton.textContent =
          "Creating...";

      }


      console.log(
        "Creating automation..."
      );


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


      if (submitButton) {

        submitButton.textContent =
          "Confirming...";

      }


      await transaction.wait();


      console.log(
        "Automation confirmed on Arc."
      );


      alert(
        "Automation created successfully on Arc."
      );


      nameInput.value = "";

      recipientInput.value = "";

      amountInput.value = "";

      if (noteInput) {
        noteInput.value = "";
      }


      /*
       * Reload blockchain data.
       */

      await loadRealAutomations();


      /*
       * Close form.
       */

      const formBox =
        document.getElementById(
          "automation-form"
        );


      const newAutomationButton =
        document.getElementById(
          "create-automation-button"
        );


      if (formBox) {
        formBox.style.display =
          "none";
      }


      if (newAutomationButton) {
        newAutomationButton.style.display =
          "block";
      }


      if (submitButton) {

        submitButton.textContent =
          "Create Automation";

        submitButton.disabled =
          false;

      }


    } catch (error) {

      console.error(
        "Create automation error:",
        error
      );


      alert(
        error.message ||
        "Unable to create automation."
      );


      const submitButton =
        form.querySelector(
          'button[type="submit"]'
        );


      if (submitButton) {

        submitButton.textContent =
          "Create Automation";

        submitButton.disabled =
          false;

      }

    }

  }


  /* =========================================
     FORM SUBMIT
  ========================================= */

  const form =
    document.getElementById(
      "automation-form-element"
    );


  if (form) {

    form.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();

        await createAutomation();

      }
    );

  }


  /* =========================================
     INITIALIZE APPKIT
  ========================================= */

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
