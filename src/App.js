import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  addDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import Auth from "./components/Auth";
import ManualEntryForm from "./components/ManualEntryForm";
import UploadForm from "./components/UploadForm";
import "./App.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from "xlsx";
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';


const finalColumnOrder = [
  "indentNumber", "date", "months", "origin", "destination", "customer", "customerType",
  "vehicleNo", "vendor", "salesRate", "buyRate", "createdAt", "createdBy", "versionDate",
  "isCurrent", "updateDescription", "expiredAt",
  // Customer Master
  "customerMaster.toBeAdvance", "customerMaster.advanceReceived", "customerMaster.advDeviation",
  "customerMaster.advanceRecDate", "customerMaster.validatedAdvanceUTRDescription",
  "customerMaster.validatedAdvanceAmount", "customerMaster.balance", "customerMaster.processingCharges",
  "customerMaster.inwardMisCharges", "customerMaster.outwardMisCharges", "customerMaster.balanceReceived",
  "customerMaster.remainingBalance", "customerMaster.balanceRecDate", "customerMaster.validatedBalanceUTR",
  "customerMaster.validatedBalanceUTRAmount",
  // Vendor Master
  "vendorMaster.vendorOutwardPayment", "vendorMaster.paidAmount", "vendorMaster.balancePending",
  "vendorMaster.vendorRemark",
  // POD Master
  "podMaster.podVendorDate", "podMaster.podSendToCustomerDate", "podMaster.docNo",
  "podMaster.podCustomerRec", "podMaster.today", "podMaster.balanceOverdueDays",
  "podMaster.toBeCollectedAmount"
];

const columnLabels = {
  indentNumber: "Indent Number",
  date: "Date",
  months: "Month",
  origin: "Origin",
  destination: "Destination",
  customer: "Customer",
  customerType: "Customer Type",
  vehicleNo: "Vehicle Number",
  vendor: "Vendor",
  salesRate: "Sales Rate",
  buyRate: "Buy Rate",
  createdAt: "Created At",
  createdBy: "Created By",
  versionDate: "Version Date",
  isCurrent: "Is Current",
  updateDescription: "Update Description",
  expiredAt: "Expired At",

  // Customer Master
  "customerMaster.toBeAdvance": "Customer Master -> To be Advance (Sales)",
  "customerMaster.advanceReceived": "Customer Master -> Advance / Payment Received",
  "customerMaster.advDeviation": "Customer Master -> Adv Deviation (as on Date)",
  "customerMaster.advanceRecDate": "Customer Master -> Advance Rec Date",
  "customerMaster.validatedAdvanceUTRDescription": "Customer Master -> Validated-Advance UTR Description",
  "customerMaster.validatedAdvanceAmount": "Customer Master -> Validated UTR - Advance Amount",
  "customerMaster.balance": "Customer Master -> Balance",
  "customerMaster.processingCharges": "Customer Master -> Processing Charges",
  "customerMaster.inwardMisCharges": "Customer Master -> Inward-Mis Charges",
  "customerMaster.outwardMisCharges": "Customer Master -> Outward-Mis Charges",
  "customerMaster.balanceReceived": "Customer Master -> Bal Received",
  "customerMaster.remainingBalance": "Customer Master -> Remaining Balance",
  "customerMaster.balanceRecDate": "Customer Master -> Balance Rec Date",
  "customerMaster.validatedBalanceUTR": "Customer Master -> Validated-Balance UTR",
  "customerMaster.validatedBalanceUTRAmount": "Customer Master -> Validate Balance UTR-Amount",

  // Vendor Master
  "vendorMaster.vendorOutwardPayment": "Vendor Master -> Outward Payment",
  "vendorMaster.paidAmount": "Vendor Master -> Paid Amount",
  "vendorMaster.balancePending": "Vendor Master -> Balance Pending",
  "vendorMaster.vendorRemark": "Vendor Master -> Vendor Remark",

  // POD Master
  "podMaster.podVendorDate": "POD Master -> POD Vendor-Date",
  "podMaster.podSendToCustomerDate": "POD Master -> POD-Send to Customer Date",
  "podMaster.docNo": "POD Master -> Doc No",
  "podMaster.podCustomerRec": "POD Master -> POD-Customer Rec",
  "podMaster.today": "POD Master -> Today",
  "podMaster.balanceOverdueDays": "POD Master -> Balance Overdue Days",
  "podMaster.toBeCollectedAmount": "POD Master -> To be Collected Amount"
};


const flattenObject = (obj, prefix = "") => {
  let result = {};
  for (const key in obj) {
    const value = obj[key];
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !value.seconds) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
};


function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [searchKey, setSearchKey] = useState("");
  const [searchField, setSearchField] = useState("indentNumber");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [originalRecords, setOriginalRecords] = useState({});
  const [isSearching, setIsSearching] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  const [includeCustomer, setIncludeCustomer] = useState(false);
  const [includeVendor, setIncludeVendor] = useState(false);
  const [includePOD, setIncludePOD] = useState(false);





  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleExportToExcel = () => {
  if (history.length === 0) {
    toast.info("❌ No history data to export.");
    return;
  }

  // Define columns to include
  const fixedCols = finalColumnOrder.slice(0, 17); // First 17 are fixed
  const customerCols = finalColumnOrder.slice(17, 32);
  const vendorCols = finalColumnOrder.slice(32, 36);
  const podCols = finalColumnOrder.slice(36);

  const selectedCols = [
    ...fixedCols,
    ...(includeCustomer ? customerCols : []),
    ...(includeVendor ? vendorCols : []),
    ...(includePOD ? podCols : [])
  ];

  const exportData = history.map((row) => {
    const flatRow = {};
    selectedCols.forEach((col) => {
      const val = row[col];
      flatRow[col] = val?.seconds
        ? new Date(val.seconds * 1000).toLocaleString()
        : val ?? "";
    });
    return flatRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Filtered Export");

  const fileName = `FilteredExport_${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};


  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const fleetRef = collection(db, "fleet_records");
      let q;

          if (searchField === "Date") {
  const fromDate = new Date(startDate);
  const toDate = new Date(endDate + "T23:59:59");

  if (fromDate > toDate) {
    toast.warn("⚠️ 'From' date cannot be after 'To' date.");
    setIsSearching(false);
    return;
  }

  q = query(
    fleetRef,
    ...(activeOnly ? [where("isCurrent", "==", true)] : []),
    where("createdAt", ">=", fromDate),
    where("createdAt", "<=", toDate)
  );
}
 else if (searchKey) {
  const key = searchField === "indentNumber" ? Number(searchKey) : searchKey;
  q = query(
    fleetRef,
    where(searchField, "==", key),
    ...(activeOnly ? [where("isCurrent", "==", true)] : [])
  );
}

 else {
        toast.warn("🔍 Please enter a search value.");
        setIsSearching(false);
        return;
      }

      setSearchAttempted(true);
      const snapshot = await getDocs(q);
      const allVersions = [];
      const currentOnly = [];

      snapshot.forEach((docSnap) => {
        const rawData = { id: docSnap.id, ...docSnap.data() };
        const row = flattenObject(rawData);

        allVersions.push(row);
        if (row.isCurrent) currentOnly.push(row);
      });
      allVersions.sort((a, b) => {
  if (a.isCurrent && !b.isCurrent) return -1;
  if (!a.isCurrent && b.isCurrent) return 1;
  return b.indentNumber - a.indentNumber;
});

// ✅ Sort currentOnly also by indentNumber descending
currentOnly.sort((a, b) => b.indentNumber - a.indentNumber);

      if (searchField === "indentNumber") {
        setRecords(currentOnly);
        setHistory(allVersions);
      } else {
        setRecords([]);
        setHistory(allVersions);
      }

      if (snapshot.empty || allVersions.length === 0) {
        toast.info("❌ No records found.");
      }
    } catch (error) {
  toast.error("❌ Search failed: " + error.message);

    } finally {
      setIsSearching(false);
    }
  };

    const normalize = (val) => {
    if (val === null || val === undefined) return "";
    return typeof val === "object" && val.seconds
      ? new Date(val.seconds * 1000).toISOString()
      : String(val).trim();
  };

 const getChangedFields = (current, original) => {
  const ignored = ["versionDate", "expiredAt", "isCurrent", "updateDescription", "createdAt", "createdBy"];
  const changed = [];

  const flatCurrent = flattenObject(current);
  const flatOriginal = flattenObject(original);

  for (const key in flatCurrent) {
    if (ignored.includes(key)) continue;
    const currVal = normalize(flatCurrent[key]);
    const origVal = normalize(flatOriginal?.[key]);
    if (currVal !== origVal) changed.push(key);
  }

  return changed;
};


  const hasMeaningfulChanges = (curr, orig) => getChangedFields(curr, orig).length > 0;


    const handleUpdate = async (row) => {
    try {
      const { id, indentNumber, ...updatedData } = row;

      const currentDocSnap = await getDocs(
        query(collection(db, "fleet_records"), where("indentNumber", "==", indentNumber), where("isCurrent", "==", true))
      );
      const oldDoc = currentDocSnap.docs.find(doc => doc.id === id);
      const oldData = flattenObject(oldDoc?.data() || {});


      const cleanData = {};
      const updateLog = [];
      for (const key in updatedData) {
        if (["id", "isCurrent", "createdAt", "createdBy", "versionDate", "updateDescription", "expiredAt"].includes(key))
          continue;
        const newVal = updatedData[key] ?? "";
        const oldVal = oldData[key] ?? "";
        cleanData[key] = newVal;

        if (String(newVal).trim() !== String(oldVal).trim()) {
          updateLog.push(`Updated ${key}`);
        }
      }

      if (updateLog.length === 0) {
        toast.info("ℹ️ No changes to update.");
        return;
      }

      confirmAlert({
  title: 'Confirm Update',
  message: `Do you want to update changes: ${updateLog.join(", ")}?`,
  buttons: [
    {
      label: 'Yes',
      onClick: async () => {
        await updateDoc(doc(db, "fleet_records", id), {
          isCurrent: false,
          expiredAt: new Date(),
          modifiedBy: user.email
        });

        const newVersion = {
          ...cleanData,
          indentNumber,
          createdAt: new Date(),
          createdBy: user.email,
          isCurrent: true,
          versionDate: new Date(),
          updateDescription: updateLog.join(", ")
        };

        await addDoc(collection(db, "fleet_records"), newVersion);
        toast.success("✅ Record updated.");
        handleSearch();
      }
    },
    {
      label: 'No'
    }
  ]
});
return;


      await updateDoc(doc(db, "fleet_records", id), {
        isCurrent: false,
        expiredAt: new Date(),
        modifiedBy: user.email
      });

      const newVersion = {
        ...cleanData,
        indentNumber,
        createdAt: new Date(),
        createdBy: user.email,
        isCurrent: true,
        versionDate: new Date(),
        updateDescription: updateLog.join(", ")
      };

      await addDoc(collection(db, "fleet_records"), newVersion);

      toast.success("✅ Record updated.");
      handleSearch();
    } catch (error) {
      toast.error("❌ Update failed: " + error.message);
    }
  };

  const handleDelete = async (fleetNumberToDelete) => {
    try {
      const q = query(collection(db, "fleet_records"), where("indentNumber", "==", fleetNumberToDelete));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
  toast.error("❌ No records found for deletion.");
  return;
}


      confirmAlert({
  title: 'Confirm Deletion',
  message: `Delete all versions of Indent No. ${fleetNumberToDelete}?`,
  buttons: [
    {
      label: 'Yes',
      onClick: async () => {
        await Promise.all(snapshot.docs.map(docSnap => deleteDoc(doc(db, "fleet_records", docSnap.id))));
        setRecords(prev => prev.filter(r => r.indentNumber !== fleetNumberToDelete));
        setHistory(prev => prev.filter(r => r.indentNumber !== fleetNumberToDelete));
        toast.success("✅ Deleted all versions.");
      }
    },
    {
      label: 'No'
    }
  ]
});
return;


      await Promise.all(snapshot.docs.map(docSnap => deleteDoc(doc(db, "fleet_records", docSnap.id))));
      setRecords(prev => prev.filter(r => r.indentNumber !== fleetNumberToDelete));
      setHistory(prev => prev.filter(r => r.indentNumber !== fleetNumberToDelete));
      toast.success("✅ Deleted all versions.");
    } catch (err) {
      toast.error("❌ Delete failed: " + err.message);
    }
  };
  if (authLoading) return <p style={{ textAlign: "center" }}>Checking authentication...</p>;
if (!user) return <Auth />;


  return (
    <div style={{ maxWidth: "100vw", overflowX: "hidden", padding: "40px 20px" }}>
      <div className="header">
        <h2>Fleet Billing Dashboard</h2>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span className="user-email">Welcome, {user.email}</span>
          <img src="/logo.png" alt="Logo" style={{ height: "50px" }} />
        </div>
      </div>

      <button
  onClick={() => {
    // ✅ Clear localStorage before logout
    localStorage.removeItem("inProgressFleetNumber");
    localStorage.removeItem("docId");
    localStorage.removeItem("fixedFields");
    localStorage.removeItem("customerFields");
    localStorage.removeItem("vendorFields");
    localStorage.removeItem("podFields");

    signOut(auth);
  }}
>
  Logout
</button>

      <hr />

      {/* <UploadForm /> */}

      <ManualEntryForm
        onAddRow={(row, addToHistory) => {
          setRecords([row]);
          if (addToHistory) setHistory([row]);
        }}
      />

      <hr />
      <h4>Search Existing Records</h4>
<div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
    <select value={searchField} onChange={(e) => {
      setSearchField(e.target.value);
      setSearchKey("");
      setStartDate("");
      setEndDate("");
    }}>
      <option value="indentNumber">Fleet Number</option>
      <option value="Broker">Broker</option>
      <option value="Date">Date</option>
    </select>

    {searchField === "Date" ? (
      <>
        <label>From:</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <label>To:</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </>
    ) : (
      <input
        type="text"
        value={searchKey}
        onChange={(e) => setSearchKey(e.target.value)}
        placeholder="Search key"
        style={{ flex: 1, width: "250px" }}
      />
    )}

    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
    <label style={{  display: "flex", alignItems: "center", fontSize: "14px", marginBottom: 0 }}>
      <input
        type="checkbox"
        checked={activeOnly}
        onChange={(e) => setActiveOnly(e.target.checked)}
        style={{ marginRight: "5px" }}
      />
      Show only active
    </label>
  </div>

  <button className="btn btn-primary" onClick={handleSearch} disabled={isSearching}>
    {isSearching ? "Searching..." : "Search"}
  </button>
</div></div>

<hr />



      {searchField === "indentNumber" && records.length > 0 && (
        <>
          <h4>Editable Current Records</h4>
          <div className="table-scroll-x">
            <table>
              <thead>
                <tr>
                  {finalColumnOrder.map((col) => (
                    <th key={col}>{columnLabels[col] || col}</th>
                  ))}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {finalColumnOrder.map((col, j) => (
                      <td key={j}>
                        <input
                          type="text"
                          value={
                            typeof row[col] === "object" && row[col]?.seconds
                              ? (col === "date"
            ? new Date(row[col].seconds * 1000).toLocaleDateString("en-GB")
            : new Date(row[col].seconds * 1000).toLocaleString()
          )
        : String(row[col] ?? "")
    }
                          onChange={(e) => {
                            const updated = [...records];
                            updated[rowIndex][col] = e.target.value;
                            setRecords(updated);
                          }}
                          readOnly={["indentNumber", "createdAt", "createdBy", "isCurrent", "updateDescription"].includes(col)}
                          style={{ width: "140px" }}
                        />
                      </td>
                    ))}
                    <td>
                      <button className="save" onClick={() => handleUpdate(row)}>
                        Save
                      </button>
                      <button className="delete" onClick={() => handleDelete(row.indentNumber)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        </>
      )}

      {history.length > 0 && (
        <>
          <hr />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
  <h4>🔍 Full Version History</h4>
  <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
  <label>
    <input type="checkbox" checked={includeCustomer} onChange={(e) => setIncludeCustomer(e.target.checked)} />
    Include Customer
  </label>
  <label>
    <input type="checkbox" checked={includeVendor} onChange={(e) => setIncludeVendor(e.target.checked)} />
    Include Vendor
  </label>
  <label>
    <input type="checkbox" checked={includePOD} onChange={(e) => setIncludePOD(e.target.checked)} />
    Include POD
  </label>
  <button onClick={handleExportToExcel} disabled={history.length === 0} className="export-button">
    ⬇️ Export Selected
  </button>
</div>

</div>
        <div className="table-scroll-x">
          <table>
            <thead>
              <tr>
                {finalColumnOrder.map((col) => (
                  <th key={col} className="tight-header">{columnLabels[col] || col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...history]
                .sort((a, b) => {
                  if (a.isCurrent) return -1;
                  if (b.isCurrent) return 1;
                  const aTime = a.expiredAt?.seconds || 0;
                  const bTime = b.expiredAt?.seconds || 0;
                  return bTime - aTime;
                })
                .map((row, i) => (
                  <tr key={i}>
                    {finalColumnOrder.map((col, j) => (
                      <td key={j}>
                        {typeof row[col] === "object" && row[col]?.seconds
              ? (col === "date"
                  ? new Date(row[col].seconds * 1000).toLocaleDateString("en-GB")
                  : new Date(row[col].seconds * 1000).toLocaleString())
              : String(row[col] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        </>
      )}

      {searchAttempted && !isSearching && records.length === 0 && history.length === 0 && (
        <p style={{ textAlign: "center", color: "#888", marginTop: "30px" }}>No records to display.</p>
      )}

      <ToastContainer position="bottom-right" autoClose={3000} />
      <p style={{ textAlign: "center", marginTop: "30px", color: "#666" }}>© 2025 Fleet Billing System</p>
    </div>
  );
}

export default App;
