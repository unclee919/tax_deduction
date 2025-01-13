# # import frappe
# # import json
# # import uuid
# # from frappe.model.document import Document

# # class SubBOQ(Document):
# #     pass

# # @frappe.whitelist()
# # def map_to_lead_custom(project_name, boq_rows):
# #     """
# #     Maps Bill of Quantity (BOQ) rows from Sub BOQ to Lead with unique names
# #     to avoid duplicate entries in the child table across different parent Doctypes.
# #     """

# #     if not project_name:
# #         frappe.throw("Project name is required to map BOQ.")

# #     # Fetch the corresponding Lead document (parent)
# #     lead_name = frappe.db.get_value('Lead', {'custom_project_name': project_name}, 'name')

# #     if not lead_name:
# #         frappe.throw(f"No Lead found with Project Name: {project_name}")

# #     lead_doc = frappe.get_doc('Lead', lead_name)

# #     # Check if custom_bill_of_quantity table exists, create it if not
# #     if not hasattr(lead_doc, "custom_bill_of_quantity"):
# #         lead_doc.custom_bill_of_quantity = []

# #     mapped_count = 0
# #     updated_count = 0

# #     # Parse boq_rows to a list of dictionaries (if it's in string format)
# #     try:
# #         boq_rows = json.loads(boq_rows)
# #     except json.JSONDecodeError as e:
# #         frappe.throw(f"Failed to decode boq_rows JSON. Error: {e}")

# #     # Track existing rows in the Lead document to avoid adding duplicates
# #     existing_row_names_in_lead = [row.get('name') for row in lead_doc.custom_bill_of_quantity]

# #     # Specify the fields that will be mapped
# #     fields_to_map = [
# #         'hid_code',   # Example Field 1 in BOQ
# #         'qty',   # Example Field 2 in BOQ
# #         'product_code', 
# #         'product_name',
# #         'uom',   # Example Field 3 in BOQ
# #         # Add more fields as needed
# #     ]

# #     for row in boq_rows:
# #         if isinstance(row, dict):
# #             # Create unique name for Sub BOQ and Lead child rows
# #             sub_boq_name = str(uuid.uuid4())  # Unique name for Sub BOQ row

# #             # Check if row already exists in Lead's custom_bill_of_quantity child table by its name
# #             existing_row = next((r for r in lead_doc.custom_bill_of_quantity if r.get("name") == sub_boq_name), None)

# #             if existing_row:
# #                 # If the row exists, update it instead of creating a new one
# #                 has_changes = False
# #                 for key in fields_to_map:
# #                     if key in row:
# #                         if existing_row.get(key) != row[key]:
# #                             existing_row[key] = row[key]
# #                             has_changes = True

# #                 if has_changes:
# #                     updated_count += 1
# #             else:
# #                 # Add new row with the unique 'name' for Lead
# #                 new_lead_boq_row = {key: row[key] for key in fields_to_map if key in row}
# #                 new_lead_boq_row['name'] = sub_boq_name  # Use the unique 'name'
# #                 new_lead_boq_row['doctype'] = 'Custom Bill of Quantity Row'

# #                 lead_doc.append('custom_bill_of_quantity', new_lead_boq_row)
# #                 mapped_count += 1

# #     # Save the Lead document after mapping
# #     lead_doc.save()

# #     return {
# #         "mapped_count": mapped_count,
# #         "updated_count": updated_count
# #     }


# # @frappe.whitelist()
# # def map_to_lead(docname):
# #     sub_boq = frappe.get_doc("Sub BOQ", docname)

# #     if not sub_boq.get("")





# import json
# import uuid

# import frappe
# from frappe import _
# from frappe.model.document import Document
# from frappe.model.mapper import map_child_doc


# class SubBOQ(Document):
#     pass


# # @frappe.whitelist()
# # def map_to_lead_custom(project_name, boq_rows):
# #     """
# #     Maps Bill of Quantity (BOQ) rows from Sub BOQ to Lead with unique names
# #     to avoid duplicate entries in the child table across different parent Doctypes.
# #     """

# #     if not project_name:
# #         frappe.throw("Project name is required to map BOQ.")

# #     # Fetch the corresponding Lead document (parent)
# #     lead_name = frappe.db.get_value(
# #         "Lead", {"custom_project_name": project_name}, "name"
# #     )

# #     if not lead_name:
# #         frappe.throw(f"No Lead found with Project Name: {project_name}")

# #     lead_doc = frappe.get_doc("Lead", lead_name)

# #     # Check if custom_bill_of_quantity table exists, create it if not
# #     if not hasattr(lead_doc, "custom_bill_of_quantity"):
# #         lead_doc.custom_bill_of_quantity = []

# #     mapped_count = 0
# #     updated_count = 0

# #     # Parse boq_rows to a list of dictionaries (if it's in string format)
# #     try:
# #         boq_rows = json.loads(boq_rows)
# #     except json.JSONDecodeError as e:
# #         frappe.throw(f"Failed to decode boq_rows JSON. Error: {e}")

# #     # Track existing rows in the Lead document to avoid adding duplicates
# #     existing_row_names_in_lead = [
# #         row.get("name") for row in lead_doc.custom_bill_of_quantity
# #     ]

# #     # Specify the fields that will be mapped
# #     fields_to_map = [
# #         "hid_code",  # Example Field 1 in BOQ
# #         "qty",  # Example Field 2 in BOQ
# #         "product_code",
# #         "product_name",
# #         "uom",  # Example Field 3 in BOQ
# #         # Add more fields as needed
# #     ]

# #     for row in boq_rows:
# #         if isinstance(row, dict):
# #             # Create unique name for Sub BOQ and Lead child rows
# #             sub_boq_name = str(uuid.uuid4())  # Unique name for Sub BOQ row

# #             # Check if row already exists in Lead's custom_bill_of_quantity child table by its name
# #             existing_row = next(
# #                 (
# #                     r
# #                     for r in lead_doc.custom_bill_of_quantity
# #                     if r.get("name") == sub_boq_name
# #                 ),
# #                 None,
# #             )

# #             if existing_row:
# #                 # If the row exists, update it instead of creating a new one
# #                 has_changes = False
# #                 for key in fields_to_map:
# #                     if key in row:
# #                         if existing_row.get(key) != row[key]:
# #                             existing_row[key] = row[key]
# #                             has_changes = True

# #                 if has_changes:
# #                     updated_count += 1
# #             else:
# #                 # Add new row with the unique 'name' for Lead
# #                 new_lead_boq_row = {
# #                     key: row[key] for key in fields_to_map if key in row
# #                 }
# #                 new_lead_boq_row["name"] = sub_boq_name  # Use the unique 'name'
# #                 new_lead_boq_row["doctype"] = "Custom Bill of Quantity Row"

# #                 lead_doc.append("custom_bill_of_quantity", new_lead_boq_row)
# #                 mapped_count += 1

# #     # Save the Lead document after mapping
# #     lead_doc.save()

# #     return {"mapped_count": mapped_count, "updated_count": updated_count}


# @frappe.whitelist()
# def map_to_lead(docname: str) -> None:
#     sub_boq = frappe.get_doc("Sub BOQ", docname)

#     if not sub_boq.get("project_name"):
#         frappe.throw(_("Please ensure the Project Name is filled."))
#         return

#     leads_list = frappe.get_all(
#         "Lead",
#         filters={"custom_project_name": sub_boq.get("project_name")},
#     )

#     if not leads_list:
#         frappe.throw(_("No Lead record found for the given Project Name."))
#         return

#     lead_name = leads_list[0]
#     lead_doc = frappe.get_doc("Lead", lead_name.get("name"))

#     if not lead_doc.get("custom_bill_of_quantity"):
#         lead_doc.set("custom_bill_of_quantity", [])

#     rows_to_be_update = []

#     lead_doc_product_codes = []
#     for i in lead_doc.get("custom_bill_of_quantity", default=[]):
#         if i.get("product_code"):
#             lead_doc_product_codes.append(i.get("product_code"))

#     mapped_count = 0
#     updated_count = 0

#     for row in sub_boq.get("bill_of_quantity"):
#         if row.get("product_code") in lead_doc_product_codes:
#             rows_to_be_update.append(row)
#             continue

#         lead_row = map_child_doc(
#             row,
#             lead_doc,
#             {
#                 "doctype": "Bill of Quantity",
#             },
#             sub_boq,
#         )

#         lead_row.set("product_code", row.get("product_code"))

#         mapped_count += 1

#     for row in rows_to_be_update:
#         lead_row_list = lead_doc.get(
#             "custom_bill_of_quantity",
#             filters={"product_code": row.get("product_code")},
#             default=[],
#         )

#         for lead_row in lead_row_list:
#             for field in row.meta.fields:
#                 lead_row.set(field.fieldname, row.get(field.fieldname))

#             updated_count += 1

#     lead_doc.flags.ignore_mandatory = True
#     lead_doc.flags.ignore_permissions = True
#     lead_doc.flags.ignore_validate_update_after_submit = True

#     lead_doc.save()

#     frappe.msgprint(
#         _(
#             "Mapped and Updated Successfully.<br>Mapped Count: {0}<br>Updated Count: {1}<br>In Project: {2}".format(
#                 mapped_count, updated_count, lead_doc.get("custom_project_name")
#             )
#         )
#     )