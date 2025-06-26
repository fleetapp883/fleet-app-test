import React, { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

const initialForm = {
  IndentNo: "",
  IndentDate: "",
  PlacementDate: "",
  Customer: "",
  CustomerType: "",
  CustomerBillingType: "",
  SourcingVendor: "",
  VendorType: "",
  VendorBillingType: "",
  Origin: "",
  Destination: "",
  VehicleNo: "",
  VehicleType: "",
  DriverNo: "",
  DispatchDate: "",
  DeliverDate: "",
  OffloadingDate: "",
  EwayBill: "",
  LRNo: "",
  SoftCopyPODRec: "",
  HardCopyPODRec: "",
  CustomerSaleRate: "",
  AdvanceToBePaid: "",
  AdvanceRec: "",
  AdvanceUTR: "",
  AdvanceRecDate: "",
  BalancePending: "",
  DetentionCharges: "",
  LoadingUnloadingCharges: "",
  MiscCharges: "",
  ProcessingCharges: "",
  NetBalance: "",
  BalanceRecAmount: "",
  BalanceUTR: "",
  BalanceRecDate: "",
  RemainingBalance: "",
  RemainingBalanceUTR: "",
  RemainingBalanceDate: "",
  SupplierBuyRate: "",
  SupplierAdvancePay: "",
  SupplierAdvancePaid: "",
  SupplierMisCharges: "",
  SupplierInvoiceNo: "",
  SupplierAdvanceUTR: "",
  SupplierAdvancePayDate: "",
  SupplierBalancePending: "",
  SupplierBalancePaidAmount: "",
  SupplierBalancePaidUTR: "",
  SupplierBalancePaidDate: "",
  RemainingSupplierAmount: "",
  PODRecDate: "",
  PODSendToCustomerDate: "",
  PODDocketNo: "",
  PODRecByCustomer: "",
  PODDeductionIfAny: "",
  GrossProfit: "",
  BadDebts: "",
  NetProfit: ""
};

const ManualEntryForm = ({ onAddRow }) => {
  const [formData, setFormData] = useState(initialForm);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const user = auth.currentUser;

      const uniqueNo = `UNQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const enrichedData = {
        ...formData,
        UniqueNo: uniqueNo,
        createdAt: new Date(),
        createdBy: user?.email || "anonymous",
        isCurrent: true,
        versionDate: new Date()
      };

      await addDoc(collection(db, "fleet_records"), enrichedData);
      onAddRow(enrichedData);
      setFormData(initialForm);

      // ✅ Clipboard copy + alert
      await navigator.clipboard.writeText(uniqueNo);
      alert(`✅ Row saved!\nUniqueNo copied: ${uniqueNo}`);
    } catch (err) {
      alert("❌ Error saving row: " + err.message);
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      <h4>Manual Entry</h4>
      <form onSubmit={handleSubmit}>
        {Object.keys(initialForm).map((key) => (
          <input
            key={key}
            name={key}
            placeholder={key}
            value={formData[key]}
            onChange={handleChange}
            style={{ margin: 4, width: "220px" }}
            required={false}
          />
        ))}
        <br />
        <button type="submit">Add Row</button>
      </form>
    </div>
  );
};

export default ManualEntryForm;
