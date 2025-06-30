import React, { useState } from "react";
import { addDoc, collection, doc, runTransaction } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db, auth } from "../firebase";

const labelToKey = {
  "Indent No": "IndentNo", "Indent Date": "IndentDate", "Placement Date": "PlacementDate",
  "Customer": "Customer", "Customer Type": "CustomerType", "Customer Billing Type": "CustomerBillingType",
  "Sourcing (Vendor)": "SourcingVendor", "Vendor Type": "VendorType", "Vendor Billing Type": "VendorBillingType",
  "Origin": "Origin", "Destination": "Destination", "Vehicle No": "VehicleNo", "Vehicle type": "VehicleType",
  "Driver No": "DriverNo", "Dispatch Date": "DispatchDate", "Deliver Date": "DeliverDate",
  "Offloading Date": "OffloadingDate", "E-way Bill": "EwayBill", "LR No.": "LRNo",
  "Soft Copy POD Rec": "SoftCopyPODRec", "Hard Copy POD Rec": "HardCopyPODRec",
  "Customer -Sale rate": "CustomerSaleRate", "Advance to be Paid": "AdvanceToBePaid",
  "Advance Rec": "AdvanceRec", "Advance UTR": "AdvanceUTR", "Advance Rec-Date": "AdvanceRecDate",
  "Balance Pending": "BalancePending", "Detention Charges": "DetentionCharges",
  "Loading/Unloading Charges": "LoadingUnloadingCharges", "Miscellaneous Charges.": "MiscCharges",
  "Processing Charges": "ProcessingCharges", "Net Balance": "NetBalance",
  "Balance Rec Amount": "BalanceRecAmount", "Balance UTR": "BalanceUTR", "Balance Rec Date": "BalanceRecDate",
  "Remaining Balance": "RemainingBalance", "Remaining Balance UTR": "RemainingBalanceUTR",
  "Remaining Balance Date": "RemainingBalanceDate", "Supplier Buy Rate": "SupplierBuyRate",
  "Supplier Advance Pay": "SupplierAdvancePay", "Supplier Advance Paid": "SupplierAdvancePaid",
  "Supplier Mis Charges": "SupplierMisCharges", "Supplier Invoice No.": "SupplierInvoiceNo",
  "Supplier Advance UTR": "SupplierAdvanceUTR", "Supplier Advance Pay-Date": "SupplierAdvancePayDate",
  "Supplier Balance Pending": "SupplierBalancePending", "Supplier Balance Paid Amount": "SupplierBalancePaidAmount",
  "Supplier Balance Paid UTR": "SupplierBalancePaidUTR", "Supplier Balance Paid Date": "SupplierBalancePaidDate",
  "Remaining Supplier Amount": "RemainingSupplierAmount", "POD Rec Date": "PODRecDate",
  "POD Send to Customer Date": "PODSendToCustomerDate", "POD Docket No.": "PODDocketNo",
  "POD Rec By Customer": "PODRecByCustomer", "POD Deduction If any": "PODDeductionIfAny",
  "Gross Profit": "GrossProfit", "Bad Debts": "BadDebts", "Net Profit": "NetProfit"
};

const dateFields = [
  "Indent Date", "Placement Date", "Dispatch Date", "Deliver Date", "Offloading Date",
  "Soft Copy POD Rec", "Hard Copy POD Rec", "Advance Rec-Date", "Balance Rec Date",
  "Remaining Balance Date", "Supplier Advance Pay-Date", "Supplier Balance Paid Date",
  "POD Rec Date", "POD Send to Customer Date", "POD Rec By Customer"
];

const UploadForm = () => {
  const [previewData, setPreviewData] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [fleetNumbers, setFleetNumbers] = useState({});

  const normalize = (label) => (label || "").replace(/[.\s]+/g, " ").trim().toLowerCase();

  const getMappedKey = (label) => {
    const normalizedLabel = normalize(label);
    return Object.entries(labelToKey).find(
      ([rawLabel]) => normalize(rawLabel) === normalizedLabel
    )?.[1];
  };

  const parseExcel = (file) => {
    if (!file) {
      alert("No file selected");
      return;
    }

    alert("File selected: " + file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      alert("File read started");

      const workbook = XLSX.read(e.target.result, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      alert("Reading sheet: " + sheetName);
      const sheet = workbook.Sheets[sheetName];

      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
      if (raw.length < 3) {
        alert("Not enough rows to parse.");
        return;
      }

      raw.splice(0, 1); // Remove useless top row
      const headers = raw[0];
      const rows = raw.slice(1).map((row, rowIndex) => {
        const obj = {};
        headers.forEach((h, j) => {
          const key = getMappedKey(h);
          if (!key) return;

          const value = row[j];
          const isDate = dateFields.some(df => normalize(df) === normalize(h));

          if (typeof value === "number" && isDate) {
            const d = XLSX.SSF.parse_date_code(value);
            if (d) {
              obj[key] = `${String(d.d).padStart(2, '0')}-${String(d.m).padStart(2, '0')}-${d.y}`;
            }
          } else {
            obj[key] = String(value ?? "").trim();
          }
        });
        return obj;
      });

      alert("Parsed rows: " + rows.length);
      setPreviewData(rows);
      setStatusMap({});
      setFleetNumbers({});
    };

    reader.onerror = (err) => {
      alert("Failed to read file: " + err);
      console.error("FileReader error:", err);
    };

    reader.readAsBinaryString(file);
  };

  const getNextFleetNumber = async () => {
    const counterRef = doc(db, "Counters", "fleet_counter");
    const newFleetNo = await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(counterRef);
      if (!docSnap.exists()) throw new Error("Counter doc missing");
      const current = docSnap.data().nextFleetNo || 1;
      transaction.update(counterRef, { nextFleetNo: current + 1 });
      return current;
    });
    return newFleetNo;
  };

  const saveRow = async (row, i) => {
    const user = auth.currentUser;
    try {
      const newFleetNo = await getNextFleetNumber();
      const enriched = {
        ...row,
        fleetNumber: newFleetNo,
        createdAt: new Date(),
        createdBy: user?.email || "anonymous",
        isCurrent: true,
        versionDate: new Date(),
      };
      await addDoc(collection(db, "fleet_records"), enriched);
      setStatusMap(prev => ({ ...prev, [i]: "✅ Saved" }));
      setFleetNumbers(prev => ({ ...prev, [i]: newFleetNo }));
    } catch (err) {
      setStatusMap(prev => ({ ...prev, [i]: "❌ Failed" }));
    }
  };

  const saveAll = async () => {
    for (let i = 0; i < previewData.length; i++) {
      if (!statusMap[i]) await saveRow(previewData[i], i);
    }
  };

  const handleEdit = (i, key, value) => {
    const updated = [...previewData];
    updated[i][key] = value;
    setPreviewData(updated);
  };

  const deleteRow = (i) => {
    setPreviewData(previewData.filter((_, idx) => idx !== i));
    const s = { ...statusMap }; delete s[i];
    const f = { ...fleetNumbers }; delete f[i];
    setStatusMap(s);
    setFleetNumbers(f);
  };

  const resetTable = () => {
    setPreviewData([]);
    setStatusMap({});
    setFleetNumbers({});
  };

  return (
    <div style={{ marginBottom: 40 }}>
      <h4>Upload Excel & Preview</h4>
      <input
        type="file"
        accept=".xlsx, .xls"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            parseExcel(file);
            setTimeout(() => {
              e.target.value = "";
            }, 100);
          } else {
            alert("No file selected.");
          }
        }}
      />
      {previewData.length > 0 && (
        <>
          <h5 style={{ marginTop: 20 }}>📄 Preview Table (Excel Upload)</h5>
          <button onClick={saveAll}>💾 Save All</button>
          <button onClick={resetTable} style={{ marginLeft: 10, color: "red" }}>🧹 Clear</button>
          <div className="table-scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Fleet Number</th>
                  {Object.keys(previewData[0]).map(key => <th key={key}>{key}</th>)}
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, i) => (
                  <tr key={i}>
                    <td>{fleetNumbers[i] || ""}</td>
                    {Object.keys(row).map((key) => (
                      <td key={key}>
                        <input
                          type="text"
                          value={row[key]}
                          onChange={(e) => handleEdit(i, key, e.target.value)}
                          style={{ width: "120px" }}
                        />
                      </td>
                    ))}
                    <td>{statusMap[i] || "⏳ Pending"}</td>
                    <td>
                      <button onClick={() => saveRow(row, i)} disabled={statusMap[i] === "✅ Saved"}>Save</button>
                      <button onClick={() => deleteRow(i)} style={{ marginLeft: 6, color: "red" }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default UploadForm;
