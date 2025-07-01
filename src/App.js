import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";
import { auth, db } from "./firebase";
import Auth from "./components/Auth";
import UploadForm from "./components/UploadForm";
import ManualEntryForm from "./components/ManualEntryForm";
import "./App.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";




const labelToKey = {
  "Fleet Number": "fleetNumber",
  "Indent No": "IndentNo", "Indent Date": "IndentDate", "Placement Date": "PlacementDate",
  "Customer": "Customer", "Customer Type": "CustomerType", "Customer Billing Type": "CustomerBillingType",
  "Sourcing (Vendor)": "SourcingVendor", "Vendor Type": "VendorType", "Vendor Billing Type": "VendorBillingType",
  "Origin": "Origin", "Destination": "Destination", "Vehicle No": "VehicleNo", "Vehicle type": "VehicleType",
  "Driver No": "DriverNo", "Dispatch Date": "DispatchDate", "Deliver Date": "DeliverDate",
  "Offloading Date": "OffloadingDate", "E-way Bill": "EwayBill", "LR No.": "LRNo",
  "Soft Copy POD Rec": "SoftCopyPODRec", "Hard Copy POD Rec": "HardCopyPODRec", "Customer -Sale rate": "CustomerSaleRate",
  "Advance to be Paid": "AdvanceToBePaid", "Advance Rec": "AdvanceRec", "Advance UTR": "AdvanceUTR",
  "Advance Rec-Date": "AdvanceRecDate", "Balance Pending": "BalancePending", "Detention Charges": "DetentionCharges",
  "Loading/Unloading Charges": "LoadingUnloadingCharges", "Miscellaneous Charges.": "MiscCharges",
  "Processing Charges": "ProcessingCharges", "Net Balance": "NetBalance", "Balance Rec Amount": "BalanceRecAmount",
  "Balance UTR": "BalanceUTR", "Balance Rec Date": "BalanceRecDate", "Remaining Balance": "RemainingBalance",
  "Remaining Balance UTR": "RemainingBalanceUTR", "Remaining Balance Date": "RemainingBalanceDate",
  "Supplier Buy Rate": "SupplierBuyRate", "Supplier Advance Pay": "SupplierAdvancePay",
  "Supplier Advance Paid": "SupplierAdvancePaid", "Supplier Mis Charges": "SupplierMisCharges",
  "Supplier Invoice No.": "SupplierInvoiceNo", "Supplier Advance UTR": "SupplierAdvanceUTR",
  "Supplier Advance Pay-Date": "SupplierAdvancePayDate", "Supplier Balance Pending": "SupplierBalancePending",
  "Supplier Balance Paid Amount": "SupplierBalancePaidAmount", "Supplier Balance Paid UTR": "SupplierBalancePaidUTR",
  "Supplier Balance Paid Date": "SupplierBalancePaidDate", "Remaining Supplier Amount": "RemainingSupplierAmount",
  "POD Rec Date": "PODRecDate", "POD Send to Customer Date": "PODSendToCustomerDate",
  "POD Docket No.": "PODDocketNo", "POD Rec By Customer": "PODRecByCustomer", "POD Deduction If any": "PODDeductionIfAny",
  "Gross Profit": "GrossProfit", "Bad Debts": "BadDebts", "Net Profit": "NetProfit",
  "isCurrent": "isCurrent", "createdBy": "createdBy", "createdAt": "createdAt", "Update Description": "updateDescription"
};

const keyToLabel = Object.fromEntries(Object.entries(labelToKey).map(([k, v]) => [v, k]));


function App() {
  const [user, setUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [searchKey, setSearchKey] = useState("");
  const [searchField, setSearchField] = useState("fleetNumber");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [originalRecords, setOriginalRecords] = useState({});
  const [isSearching, setIsSearching] = useState(false);
  const [isExporting, setIsExporting] = useState(false);




  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // const handleExport = () => {
  //   import("xlsx").then((xlsx) => {
  //     const rows = history.map((row) => {
  //       const flatRow = {};
  //       Object.keys(row).forEach((k) => {
  //         const value = row[k];
  //         flatRow[k] =
  //           typeof value === "object" && value?.seconds
  //             ? new Date(value.seconds * 1000).toLocaleString()
  //             : String(value ?? "");
  //       });
  //       return flatRow;
  //     });

  //     const worksheet = xlsx.utils.json_to_sheet(rows);
  //     const workbook = xlsx.utils.book_new();
  //     xlsx.utils.book_append_sheet(workbook, worksheet, "History");
  //     xlsx.writeFile(workbook, "Fleet_Full_Version_History.xlsx");
  //   });
  // };
const handleExport = () => {
  setIsExporting(true);
  toast.info("⏳ Preparing Excel export...");

  import("xlsx").then((xlsx) => {
    const rows = history.map((row) => {
      const flatRow = {};
      Object.keys(row).forEach((k) => {
        const value = row[k];
        flatRow[k] =
          typeof value === "object" && value?.seconds
            ? new Date(value.seconds * 1000).toLocaleString()
            : String(value ?? "");
      });
      return flatRow;
    });

    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "History");
    xlsx.writeFile(workbook, "Fleet_Full_Version_History.xlsx");

    toast.success("✅ Export complete.");
  }).catch((err) => {
    toast.error("❌ Export failed: " + err.message);
  }).finally(() => {
    setIsExporting(false);
  });
};



const handleSearch = async () => {
  setIsSearching(true);
  try {
    const fleetRef = collection(db, "fleet_records");
    let q;

    if (searchField === "Date") {
      if (!startDate || !endDate) {
        toast.warn("📅 Please select both From and To dates.");
        setIsSearching(false);
        return;
      }

      const fromDate = new Date(startDate);
      const toDate = new Date(endDate + "T23:59:59");

      if (fromDate > toDate) {
        toast.warn("⚠️ 'From' date cannot be after 'To' date.");
        setIsSearching(false);
        return;
      }

      q = query(fleetRef, where("createdAt", ">=", fromDate), where("createdAt", "<=", toDate));
    } else if (searchKey) {
      const key = searchField === "fleetNumber" ? Number(searchKey) : searchKey;
      q = query(fleetRef, where(searchField, "==", key));
    } else {
      toast.warn("🔍 Please enter a search value.");
      setIsSearching(false);
      return;
    }

    const snapshot = await getDocs(q);
    const allVersions = [];
    const currentOnly = [];

    snapshot.forEach((docSnap) => {
      const row = { id: docSnap.id, ...docSnap.data() };
      allVersions.push(row);
      if (row.isCurrent) currentOnly.push(row);
    });

if (searchField === "fleetNumber" || searchField === "Broker") {
  setRecords(currentOnly);
  setHistory(allVersions);
} else if (searchField === "Date") {
  setRecords([]); // Clear editable
  setHistory(allVersions);
}


    // 🛑 Show toast if no results found
    if (snapshot.empty || allVersions.length === 0) {
      let msg = "❌ No data found.";
      if (searchField === "Date") {
        msg = `❌ No data available between ${startDate} and ${endDate}`;
      } else if (searchField === "fleetNumber") {
        msg = `❌ No record found for Fleet Number: ${searchKey}`;
      } else if (searchField === "Broker") {
        msg = `❌ No record found for Broker: ${searchKey}`;
      }
      toast.info(msg);
    }

  } catch (error) {
    toast.error("❌ Search failed: " + error.message);
  } finally {
    setIsSearching(false);
  }
};


const ignoredFields = ["versionDate", "expiredAt", "isCurrent", "updateDescription", "createdAt", "createdBy"];

const normalize = (val) => {
  if (val === null || val === undefined) return "";
  return typeof val === "object" && val.seconds
    ? new Date(val.seconds * 1000).toISOString()
    : String(val).trim();
};

const getChangedFields = (current, original) => {
  const changed = [];
  for (const key in current) {
    if (ignoredFields.includes(key)) continue;
    const currVal = normalize(current[key]);
    const origVal = normalize(original?.[key]);
    if (currVal !== origVal) changed.push(key);
  }
  return changed;
};

const hasMeaningfulChanges = (curr, orig) => getChangedFields(curr, orig).length > 0;


const handleUpdate = async (row) => {
  try {
    const { id, fleetNumber, ...updatedData } = row;

    const currentDocSnap = await getDocs(
      query(collection(db, "fleet_records"), where("fleetNumber", "==", fleetNumber), where("isCurrent", "==", true))
    );
    const oldDoc = currentDocSnap.docs.find(doc => doc.id === id);
    const oldData = oldDoc?.data() || {};

    const cleanData = {};
    const updateLog = [];
    const ignoredFields = ["id", "isCurrent", "createdAt", "createdBy", "versionDate", "updateDescription", "expiredAt", "modifiedBy"];

    let hasChanged = false;

    for (const key in updatedData) {
      if (ignoredFields.includes(key)) continue;

      const newVal = updatedData[key] ?? "";
      const oldVal = oldData[key] ?? "";

      cleanData[key] = newVal;

      if (String(newVal).trim() !== String(oldVal).trim() && keyToLabel[key]) {
        updateLog.push(`Updated ${keyToLabel[key]}`);
        hasChanged = true;
      }
    }

    if (!hasChanged) {
      toast.info("ℹ️ No changes detected — update skipped.");
      return;
    }

    // ✅ Confirmation before updating
    const confirm = window.confirm(`Are you sure you want to update this record?\nChanges: ${updateLog.join(", ")}`);
    if (!confirm) return;

    const updateDescription = updateLog.join(", ");

    await updateDoc(doc(db, "fleet_records", id), {
      isCurrent: false,
      expiredAt: new Date(),
      modifiedBy: user.email
    });

    const newVersion = {
      ...cleanData,
      fleetNumber,
      createdAt: new Date(),
      createdBy: user.email,
      isCurrent: true,
      versionDate: new Date(),
      updateDescription
    };

    const docRef = await addDoc(collection(db, "fleet_records"), newVersion);

    const q = query(collection(db, "fleet_records"), where("fleetNumber", "==", fleetNumber));
    const snapshot = await getDocs(q);
    const allVersions = [];
    const currentOnly = [];

    snapshot.forEach((docSnap) => {
      const row = { id: docSnap.id, ...docSnap.data() };
      allVersions.push(row);
      if (row.isCurrent) currentOnly.push(row);
    });

    setHistory(allVersions);
    setRecords(currentOnly);

    const originalMap = {};
    currentOnly.forEach((r) => originalMap[r.id] = { ...r });
    setOriginalRecords(originalMap);

    toast.success("✅ Record updated (SCD Type 2)");
  } catch (error) {
    toast.error("❌ Update failed: " + error.message);
  }
};


const handleDelete = async (fleetNumberToDelete) => {
  try {
    const q = query(collection(db, "fleet_records"), where("fleetNumber", "==", fleetNumberToDelete));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      alert("❌ No records found for this fleet number.");
      return;
    }

    const confirmDelete = window.confirm(`Delete ALL versions for fleet number ${fleetNumberToDelete}?`);
    if (!confirmDelete) return;

    const batchDeletes = snapshot.docs.map(docSnap => deleteDoc(doc(db, "fleet_records", docSnap.id)));
    await Promise.all(batchDeletes);

    // Remove from both tables
    setRecords(prev => prev.filter(r => r.fleetNumber !== fleetNumberToDelete));
    setHistory(prev => prev.filter(r => r.fleetNumber !== fleetNumberToDelete));

    alert(`✅ All versions of Fleet Number ${fleetNumberToDelete} deleted.`);
  } catch (error) {
    alert("❌ Delete error: " + error.message);
  }
};


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



      <button onClick={() => signOut(auth)}>Logout</button>
      <hr />
      <UploadForm />
      <ManualEntryForm
  onAddRow={(row, addToHistory) => {
    setRecords([row]);
    if (addToHistory) setHistory([row]);
  }}
/>


      <hr />
     <h4>Search Existing Records</h4>
     <div className="search-bar">
<select value={searchField} onChange={(e) => {
  setSearchField(e.target.value);
  setSearchKey("");
  setStartDate("");
  setEndDate("");
}}>
  <option value="fleetNumber">Fleet Number</option>
  <option value="Broker">Broker</option>
  <option value="Date">Date</option>
</select>

{searchField === "Date" ? (
  <>
    <label style={{ marginLeft: 10 }}>From:</label>
    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
    <label style={{ marginLeft: 10 }}>To:</label>
    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
  </>
) : (
  <input
    type="text"
    value={searchKey}
    onChange={(e) => setSearchKey(e.target.value)}
    placeholder="Search key"
    style={{ margin: "0 10px" }}
  />
)}

<button onClick={handleSearch} style={{ marginLeft: 10 }} disabled={isSearching}>
  {isSearching ? (
    <>
      Searching... <span className="loader-spinner" />
    </>
  ) : (
    "Search"
  )}
</button>

</div>

      <hr />
      {searchField === "fleetNumber" && records.length > 0 && (
      <>
      <h4>Editable Current Records</h4>
    <div className="table-scroll-x">
      <table>
        <thead>
          <tr>
            {["Fleet Number", ...Object.keys(labelToKey).filter(l => l !== "Fleet Number").sort()].map((label) => (
              <th key={label}>{label}</th>
            ))}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((row, rowIndex) => {
            const readOnly = ["fleetNumber", "createdAt", "createdBy", "isCurrent", "updateDescription"];
            return (
              <tr key={rowIndex}>
                {["Fleet Number", ...Object.keys(labelToKey).filter(l => l !== "Fleet Number").sort()].map((label) => {
  const key = labelToKey[label];
  return (
    <td key={key}>
      <input
        type="text"
        value={
          typeof row[key] === "object" && row[key]?.seconds
            ? new Date(row[key].seconds * 1000).toLocaleString()
            : String(row[key] ?? "")
        }
        onChange={(e) => {
          const updated = [...records];
          updated[rowIndex][key] = e.target.value;
          setRecords(updated);
        }}
        readOnly={["fleetNumber", "createdAt", "createdBy", "isCurrent","updateDescription"].includes(key)}
        style={{ width: "120px" }}
      />
    </td>
  );
})}

                
                <td>
                 <button
  className="save"
  disabled={!hasMeaningfulChanges(row, originalRecords[row.id])}
  onClick={() => handleUpdate(row)}
>
  Save
</button>

<button
  className="delete"
  onClick={() => handleDelete(row.fleetNumber)}
>
  Delete
</button>


                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </>
)}

      {history.length > 0 && (
        <>
          <hr />
          <h4>🔍 Full Version History</h4>
          <button onClick={handleExport} disabled={isExporting}>
  📄 Export to Excel
  {isExporting && <span className="loader-spinner" />}
</button>

          <div className="table-scroll-x">
            <table>
              <thead>
                <tr>
                  {["fleetNumber", ...[...new Set(history.flatMap(Object.keys))]
                      .filter(col => col !== "fleetNumber")
                    .sort()].map((col) => (
                    <th key={col}>{col}</th>
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
                      {["fleetNumber", ...[...new Set(history.flatMap(Object.keys))]
  .filter(col => col !== "fleetNumber")
  .sort()].map((col, j) => (
    <td key={j}>
      {typeof row[col] === "object" && row[col]?.seconds
        ? new Date(row[col].seconds * 1000).toLocaleString()
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
      {records.length === 0 && history.length === 0 && (
  <p style={{ textAlign: "center", color: "#888", marginTop: "30px" }}>
    No records to display.
  </p>
)}
      <ToastContainer position="bottom-right" autoClose={3000} />
      <p style={{ textAlign: "center", marginTop: "30px", color: "#666" }}>
  © 2025 Fleet Billing System
</p>

    </div>
  );
}

export default App;
