import React, { useState } from "react";
import { addDoc, collection, doc, runTransaction } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db, auth } from "../firebase";

const dateFieldKeys = [
  "placementDate",
  "deliveryDate",
  "customerMaster.advanceRecDate",
  "customerMaster.balanceRecDate",
  "podMaster.podVendorDate",
  "podMaster.podSendToCustomerDate",
  "podMaster.podCustomerRec",
  "podMaster.today"
];


const labelToKey = {
  "Placement Date": "placementDate",
  "Delivery Date": "deliveryDate",
  "Month": "months",
  "Origin": "origin",
  "Destination": "destination",
  "Customer": "customer",
  "Customer Type": "customerType",
  "Vehicle Number": "vehicleNo",
  "Vendor": "vendor",
  "Sales Rate": "salesRate",
  "Buy Rate": "buyRate",
  // Customer Master
  "Customer -> To be Advance (Sales)": "customerMaster.toBeAdvance",
  "Customer -> Advance / Payment Received": "customerMaster.advanceReceived",
  "Customer -> Adv Deviation (as on Date)": "customerMaster.advDeviation",
  "Customer -> Advance Rec Date": "customerMaster.advanceRecDate",
  "Customer -> Validated-Advance UTR Description": "customerMaster.validatedAdvanceUTRDescription",
  "Customer -> Validated UTR - Advance Amount": "customerMaster.validatedAdvanceAmount",
  "Customer -> Balance": "customerMaster.balance",
  "Customer -> Processing Charges": "customerMaster.processingCharges",
  "Customer -> Inward-Mis Charges": "customerMaster.inwardMisCharges",
  "Customer -> Outward-Mis Charges": "customerMaster.outwardMisCharges",
  "Customer -> Bal Received": "customerMaster.balanceReceived",
  "Customer -> Remaining Balance": "customerMaster.remainingBalance",
  "Customer -> Balance Rec Date": "customerMaster.balanceRecDate",
  "Customer -> Validated-Balance UTR": "customerMaster.validatedBalanceUTR",
  "Customer -> Validate Balance UTR-Amount": "customerMaster.validatedBalanceUTRAmount",
  // Vendor Master
  "Vendor -> Outward Payment": "vendorMaster.vendorOutwardPayment",
  "Vendor -> Paid Amount": "vendorMaster.paidAmount",
  "Vendor -> Balance Pending": "vendorMaster.balancePending",
  "Vendor -> Vendor Remark": "vendorMaster.vendorRemark",
  // POD Master
  "POD -> POD Vendor-Date": "podMaster.podVendorDate",
  "POD -> POD-Send to Customer Date": "podMaster.podSendToCustomerDate",
  "POD -> Doc No": "podMaster.docNo",
  "POD -> POD-Customer Rec": "podMaster.podCustomerRec",
  "POD -> Today": "podMaster.today",
  "POD -> Balance Overdue Days": "podMaster.balanceOverdueDays",
  "POD -> To be Collected Amount": "podMaster.toBeCollectedAmount"
};

const UploadForm = () => {
  const [previewData, setPreviewData] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [fleetNumbers, setFleetNumbers] = useState({});

  const generateTemplate = () => {
  const headers = Object.keys(labelToKey);
  const sampleRow = {};
  headers.forEach(header => {
    const key = labelToKey[header];
    if (dateFieldKeys.includes(key)) {
      sampleRow[header] = "01-01-2025"; // DD-MM-YYYY
    } else if (header.toLowerCase() === "month" || header.toLowerCase().includes("month")) {
      sampleRow[header] = "July-2025"; // Month format
    } else if (header.toLowerCase().includes("rate") || header.toLowerCase().includes("amount")) {
      sampleRow[header] = "10000";
    } else if (header.toLowerCase().includes("number") || header.toLowerCase().includes("no")) {
      sampleRow[header] = "ABC123";
    } else {
      sampleRow[header] = "Sample";
    }
  });

  const worksheet = XLSX.utils.json_to_sheet([sampleRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  XLSX.writeFile(workbook, "FleetUploadTemplate.xlsx");
};


  const getMappedKey = (label) => labelToKey[label.trim()] || null;

  const parseExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: "binary" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });

      const headers = raw[0];
      const rows = raw.slice(1).map((row) => {
        const obj = {};
        headers.forEach((h, j) => {
          const key = getMappedKey(h);
          if (key) obj[key] = row[j];
        });
        return obj;
      });

      setPreviewData(rows);
      setStatusMap({});
      setFleetNumbers({});
    };
    reader.readAsBinaryString(file);
  };

  const getNextFleetNumber = async () => {
    const counterRef = doc(db, "Counters", "fleet_counter");
    const newFleetNo = await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(counterRef);
      const current = docSnap.data().nextFleetNo || 1;
      transaction.update(counterRef, { nextFleetNo: current + 1 });
      return current;
    });
    return newFleetNo;
  };
  const parseDDMMYYYY = (str) => {
  const [dd, mm, yyyy] = str.split("-");
  if (!dd || !mm || !yyyy) return null;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));  // Local timezone-safe
};



  const saveRow = async (row, i) => {
  const user = auth.currentUser;
  try {
    const fleetNo = await getNextFleetNumber(); // This is your indentNumber now

    const parsedRow = { ...row };
    Object.keys(parsedRow).forEach((key) => {
      if (typeof parsedRow[key] === "string" && parsedRow[key].match(/^\d{2}-\d{2}-\d{4}$/)) {
        const parsedDate = parseDDMMYYYY(parsedRow[key]);
        if (parsedDate instanceof Date && !isNaN(parsedDate)) {
          parsedRow[key] = parsedDate;
        }
      }
    });
    if (parsedRow.placementDate && !parsedRow.date) {
  parsedRow.date = parsedRow.placementDate;
}
    const enriched = {
      ...parsedRow,
      indentNumber: fleetNo, // ✅ THIS FIXES IT
      createdAt: new Date(),
      createdBy: user?.email || "anonymous",
      isCurrent: true,
      versionDate: new Date(),
    };

    await addDoc(collection(db, "fleet_records"), enriched);
    setStatusMap((prev) => ({ ...prev, [i]: "✅ Saved" }));
    setFleetNumbers((prev) => ({ ...prev, [i]: fleetNo }));
  } catch (err) {
    setStatusMap((prev) => ({ ...prev, [i]: "❌ Failed" }));
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
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              parseExcel(file);
              setTimeout(() => { e.target.value = ""; }, 100);
            }
          }}
        />
        <button onClick={generateTemplate}>⬇️ Download Template</button>
      </div>

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
                  {Object.keys(previewData[0]).map((key) => <th key={key}>{key}</th>)}
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
                            type={dateFieldKeys.includes(key) ? "date" : "text"}
                            value={
                              dateFieldKeys.includes(key) && row[key]
                                ? (() => {
                                    try {
                                      const d = new Date(row[key]);
                                      return isNaN(d.getTime()) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];

                                    } catch {
                                      return "";
                                    }
                                  })()
                                : row[key]
                            }
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
