// import frappe
// from frappe.model.document import Document

// @frappe.whitelist()
// def create_supplier_quotations(rfq_name):
//     rfq = frappe.get_doc('Request for Quotation', rfq_name)
//     created_quotations = []

//     for supplier_row in rfq.suppliers:
//         supplier_quotation = frappe.get_doc({
//             'doctype': 'Supplier Quotation',
//             'supplier': supplier_row.supplier,
//             'transaction_date': frappe.utils.nowdate(),
//             'custom_material_request': rfq.custom_material_request,
//             'custom_bill_of_quantity': rfq.custom_lead,
//             'custom_request_for_quotation': rfq_name,
//             'items': [
//                 {
//                     'item_code': item.item_code,
//                     'item_name': item.item_name,
//                     'description': item.description,
//                     'qty': item.qty,
//                     'rate': item.rate,
//                     'material_request': item.material_request,
//                     'material_request_item': item.material_request_item,
//                     'request_for_quotation': rfq_name,
//                     'request_for_quotation_item': item.name,
//                     'custom_bill_of_quanitity': item.custom_bill_of_quantity,
//                     'custom_bill_of_quanitity_item': item.custom_bill_of_quantity_item,
//                     'warehouse': item.warehouse
//                 }
//                 for item in rfq.items

//             ]
//         })

//         supplier_quotation.insert()
//         created_quotations.append(supplier_quotation.name)

//     frappe.db.commit()
//     return created_quotations
// frappe.ui.form.on('Request for Quotation', {
//         refresh: function(frm) {
            
//             frm.add_custom_button(__('Create Quotation'), function() {
//                 create_supplier_quotations(frm);
//             });
    

//         },
//     });
    