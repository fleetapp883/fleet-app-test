from google.cloud import bigquery
from firebase_functions import firestore_fn
from firebase_admin import initialize_app, firestore
import logging
import json
import uuid
from datetime import datetime
from google.cloud.firestore_v1 import DocumentSnapshot

# Initialize Firebase Admin
initialize_app()

# Helper: Convert Firestore-safe types to JSON-serializable
def clean_data(data):
    def convert(value):
        if isinstance(value, datetime):
            return value.isoformat()
        elif isinstance(value, firestore.GeoPoint):
            return {"latitude": value.latitude, "longitude": value.longitude}
        elif isinstance(value, firestore.DocumentReference):
            return value.path
        elif isinstance(value, list):
            return [convert(v) for v in value]
        elif isinstance(value, dict):
            return {k: convert(v) for k, v in value.items()}
        else:
            return value
    return convert(data)

# Firestore Trigger Function
@firestore_fn.on_document_written(document="fleet_records/{docId}", region="us-central1")
def sync_firestore_to_bigquery(event: firestore_fn.Event[firestore_fn.Change]):
    logging.info("🔥 Firestore Trigger Executed")

    doc_id = event.params.get("docId")
    after_data: DocumentSnapshot = event.data.after
    before_data: DocumentSnapshot = event.data.before

    # Determine operation
    if after_data is None:
        operation = "DELETE"
    elif before_data is None:
        operation = "CREATE"
    else:
        operation = "UPDATE"

    # Prepare row
    try:
        client = bigquery.Client()
        dataset_id = "firestore_export"
        table_id = "posts_raw_changelog"
        table_ref = client.dataset(dataset_id).table(table_id)

        row = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_id": event.id or str(uuid.uuid4()),
            "document_name": f"projects/{client.project}/databases/(default)/documents/fleet_records/{doc_id}",
            "operation": operation,
            "data": json.dumps(clean_data(after_data.to_dict()) if after_data else None),
            "old_data": json.dumps(clean_data(before_data.to_dict()) if before_data else None),
            "document_id": doc_id,
        }

        logging.info(f"📤 Prepared row for BigQuery: {row}")

        errors = client.insert_rows_json(table_ref, [row])
        if errors:
            logging.error(f"❌ BigQuery insert error: {errors}")
        else:
            logging.info("✅ Row inserted into BigQuery successfully.")

    except Exception as e:
        logging.exception(f"🔥 Error syncing to BigQuery: {e}")
