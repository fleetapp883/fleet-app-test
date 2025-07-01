import React, { useState } from "react";
import {
  collection,
  addDoc,
  doc,
  runTransaction
} from "firebase/firestore";
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
  const [isSubmitting, setIsSubmitting] = useState(false);


  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getNextFleetNumber = async () => {
    const counterRef = doc(db, "Counters", "fleet_counter");

    const newFleetNo = await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(counterRef);
      if (!docSnap.exists()) {
        throw new Error("Counter document does not exist.");
      }

      const current = docSnap.data().nextFleetNo || 1;
      transaction.update(counterRef, { nextFleetNo: current + 1 });
      return current;
    });

    return newFleetNo;
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  if (isSubmitting) return;

  setIsSubmitting(true);

  try {
    const user = auth.currentUser;
    const fleetNumber = await getNextFleetNumber();

    const enrichedData = {
      ...formData,
      fleetNumber,
      createdAt: new Date(),
      createdBy: user?.email || "anonymous",
      isCurrent: true,
      versionDate: new Date()
    };

    const docRef = await addDoc(collection(db, "fleet_records"), enrichedData);
    onAddRow({ id: docRef.id, ...enrichedData });

    setFormData(initialForm);

    await navigator.clipboard.writeText(String(fleetNumber));
    alert(`✅ Row saved!\nFleet Number copied: ${fleetNumber}`);
  } catch (err) {
    alert("❌ Error saving row: " + err.message);
  } finally {
    setIsSubmitting(false);
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
        <button type="submit" disabled={isSubmitting}>
  {isSubmitting ? (
    <>
      Saving... <span className="loader-spinner" />
    </>
  ) : "Add Row"}
</button>

      </form>
    </div>
  );
};

export default ManualEntryForm;
