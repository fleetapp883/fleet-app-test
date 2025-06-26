import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";
import { auth, db } from "./firebase";
import Auth from "./components/Auth";
import UploadForm from "./components/UploadForm";
import ManualEntryForm from "./components/ManualEntryForm";
import "./App.css";

const labelToKey = {
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
  "UniqueNo": "UniqueNo", "isCurrent": "isCurrent", "createdBy": "createdBy", "createdAt": "createdAt"
};

const keyToLabel = Object.fromEntries(Object.entries(labelToKey).map(([k, v]) => [v, k]));

function App() {
  const [user, setUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [searchKey, setSearchKey] = useState("");
  const [searchField, setSearchField] = useState("UniqueNo");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleExport = () => {
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
    });
  };

const handleSearch = async () => {
  try {
    const fleetRef = collection(db, "fleet_records");
    let q;

    if (searchField === "Date" && startDate && endDate) {
      const fromDate = new Date(startDate);
      const toDate = new Date(endDate + "T23:59:59");
      q = query(fleetRef, where("createdAt", ">=", fromDate), where("createdAt", "<=", toDate));
    } else if (searchKey) {
      q = query(fleetRef, where(searchField, "==", searchKey));
    } else {
      q = query(fleetRef);
    }

    const snapshot = await getDocs(q);
    const allVersions = [];
    const currentOnly = [];

    snapshot.forEach((docSnap) => {
      const row = { id: docSnap.id, ...docSnap.data() };
      allVersions.push(row);
      if (row.isCurrent) currentOnly.push(row);
    });

    setHistory(allVersions);
    setRecords(searchField === "UniqueNo" || searchField === "Broker" ? currentOnly : []);
  } catch (error) {
    alert("Search failed: " + error.message);
  }
};



  const handleUpdate = async (row) => {
    try {
      const { id, ...rest } = row;
      const cleanData = {};
      for (const key in rest) {
        cleanData[key] =
          typeof rest[key] === "string" || typeof rest[key] === "number"
            ? rest[key]
            : String(rest[key] ?? "");
      }

      await updateDoc(doc(db, "fleet_records", id), {
        isCurrent: false,
        expiredAt: new Date(),
        modifiedBy: user.email
      });

      const newVersion = {
        ...cleanData,
        createdAt: new Date(),
        createdBy: user.email,
        isCurrent: true,
        versionDate: new Date()
      };

      const docRef = await addDoc(collection(db, "fleet_records"), newVersion);

      const updatedRecords = records.map((r) =>
        r.id === id ? { ...newVersion, id: docRef.id } : r
      );
      setRecords(updatedRecords);
      handleSearch();

      alert("✅ Record updated (SCD Type 2)");
    } catch (error) {
      alert("❌ Update failed: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "fleet_records", id));
      setRecords(records.filter((r) => r.id !== id));
      alert("🗑️ Deleted successfully");
    } catch (error) {
      alert("❌ Delete error: " + error.message);
    }
  };

  if (!user) return <Auth />;

  return (
    <div style={{ padding: 20 }}>
      <h2>Welcome, {user.email}</h2>
      <button onClick={() => signOut(auth)}>Logout</button>
      <hr />
      <UploadForm onDataParsed={(data) => setRecords([...records, ...data])} />
      <ManualEntryForm onAddRow={(row) => setRecords([row])} />

      <hr />
     <h4>Search Existing Records</h4>
<select value={searchField} onChange={(e) => {
  setSearchField(e.target.value);
  setSearchKey("");
  setStartDate("");
  setEndDate("");
}}>
  <option value="UniqueNo">UniqueNo</option>
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

<button onClick={handleSearch} style={{ marginLeft: 10 }}>Search</button>

      <hr />
      {searchField === "UniqueNo" && records.length > 0 && (
      <>
      <h4>Editable Current Records</h4>
    <div className="table-scroll-x">
      <table>
        <thead>
          <tr>
            {Object.keys(labelToKey).map((label) => (
              <th key={label}>{label}</th>
            ))}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((row, rowIndex) => {
            const readOnly = ["UniqueNo", "createdAt", "createdBy", "isCurrent"];
            return (
              <tr key={rowIndex}>
                {Object.entries(labelToKey).map(([label, key]) => (
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
                      readOnly={readOnly.includes(key)}
                      style={{ width: "120px" }}
                    />
                  </td>
                ))}
                <td>
                  <button onClick={() => handleUpdate(row)}>Save</button>
                  <button
                    onClick={() => {
                      if (window.confirm("Delete this row?")) handleDelete(row.id);
                    }}
                    style={{ color: "red", marginLeft: 8 }}
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
          <button onClick={handleExport}>📄 Export to Excel</button>
          <div className="table-scroll-x">
            <table>
              <thead>
                <tr>
                  {[...new Set(history.flatMap(Object.keys))].map((col) => (
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
                      {[...new Set(history.flatMap(Object.keys))].map((col, j) => (
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
    </div>
  );
}

export default App;
