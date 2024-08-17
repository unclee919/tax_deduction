// public/js/Generate Codes.js

// Function to create items from BoQ
async function createItemsFromBoQ(frm) {
    console.log("createItemsFromBoQ function called");
    let items_created = 0;
    let items_skipped = 0;
    const processedItemCodes = new Set();

    async function checkItemExists(hid_code) {
        try {
            return await frappe.db.exists('Item', hid_code);
        } catch (err) {
            console.error(`Error checking item existence with hid_code "${hid_code}":`, err);
            throw err;
        }
    }

    async function createItem(itemData) {
        console.log("createItem function called for", itemData.item_code);
        const item_doc = frappe.model.get_new_doc('Item');
        Object.assign(item_doc, itemData);

        try {
            const new_item = await frappe.db.insert(item_doc);
            items_created++;
            processedItemCodes.add(itemData.item_code);

            frm.doc.custom_bill_of_quantity.forEach(row => {
                if (row.hid_code === itemData.item_code) {
                    frappe.model.set_value(row.doctype, row.name, 'is_created', 1);
                    frappe.model.set_value(row.doctype, row.name, 'product_code', new_item.item_code);
                }
            });
        } catch (err) {
            console.error(`Error creating item with hid_code "${itemData.item_code}":`, err);
            items_skipped++;
            frappe.msgprint(__('Error creating item with hid_code "%s": %s', [itemData.item_code, err.message || 'Unknown error']));
        }
    }

    for (const row of frm.doc.custom_bill_of_quantity) {
        if (row.hid_code && row.product_name && row.uom) {
            if (processedItemCodes.has(row.hid_code)) {
                items_skipped++;
                continue;
            }

            try {
                const exists = await checkItemExists(row.hid_code);
                if (exists) {
                    items_skipped++;
                    console.log(`Item with hid_code "${row.hid_code}" already exists.`);
                } else {
                    const itemData = {
                        item_code: row.hid_code,
                        item_name: row.product_name,
                        stock_uom: row.uom,
                        item_group: row.product_code_category,
                        custom_item_link: row.item_link,
                        custom_building_number: row.building_number,
                        custom_area: row.area,
                        custom_document: row.document,
                        custom_room_name: row.room_name,
                        custom_room_number: row.room_number,
                        custom_floor_level: row.floor_level,
                        custom_supplier: row.supplier,
                        custom_supplier_part_number: row.supplier_part_number,
                        custom_diemension: row.diemensions,
                        custom_describition: row.descripition,
                        custom_boq: frm.doc.name,
                        custom_desugner_item_code: row.designer_item_code,
                        custom_reference_document: row.refreference_document,
                        custom_specification_details: row.specification_details,
                        image:row.attach_image_wjpb
                    };
                    await createItem(itemData);
                }
            } catch (err) {
                console.error(`Error checking item existence with hid_code "${row.hid_code}":`, err);
                items_skipped++;
            }
        }
    }

    // Save the document after processing all items
    try {
        await frm.save();
        frappe.msgprint(__('Items creation process completed. Created: %s, Skipped: %s', [items_created, items_skipped]));
    } catch (err) {
        console.error('Error saving document:', err);
        frappe.msgprint(__('There was an issue saving the document.'));
    }
}

// Function to create a Material Request
async function createMaterialRequest(frm) {
    console.log("createMaterialRequest function called");
    try {
        const new_doc = frappe.model.get_new_doc('Material Request');
        new_doc.material_request_type = 'Purchase';
        new_doc.transaction_date = frappe.datetime.nowdate();
        new_doc.schedule_date = frappe.datetime.nowdate();
        new_doc.custom_from_bill_of_quantity = frm.doc.name;
        new_doc.set_warehouse = frm.doc.custom_warhouse;
        new_doc.custom_project_name = frm.doc.custom_project_name;
        new_doc.custom_project_number = frm.doc.custom_project_id;

        frm.doc.custom_bill_of_quantity.forEach(row => {
            const item = frappe.model.add_child(new_doc, 'Material Request Item', 'items');
            item.item_code = row.product_code;
            item.item_name = row.product_name;
            item.stock_uom = row.uom;
            item.qty = row.qty;
            item.schedule_date = frappe.datetime.nowdate();
            item.custom_supplier = row.supplier;
            item.warehouse = frm.doc.custom_warhouse;
            item.custom_and_clearance = row.custom_and_clearance;
            item.logistics = row.logistics;
            item.additional_cost = row.additional_cost;
            item.oh = row.oh;
            item.profit_margin = row.profit_margin;
            item.initial_cost = row.initial_cost;
            item.initial_cost_per_unit = row.initial_cost_per_unit;
            item.initial_cost_in_product_currency = row.initial_cost_in_product_currency;
            item.exchange_rate = row.exchange_rate;
            item.cost_before_margin = row.cost_before_margin;
            item.final_rate = row.final_rate;
            item.custom_from_bill_of_quantity = frm.doc.name;
            item.custom_from_bill_of_quantity_item = row.name;

            // Add additional fields here
            item.custom_field_1 = row.custom_field_1; // Example of additional field
            item.custom_field_2 = row.custom_field_2; // Example of additional field
        });

        const doc = await frappe.db.insert(new_doc);
        frappe.set_route('Form', 'Material Request', doc.name);
        // Update Lead Doctype with new stage
        frm.set_value('custom_lead_stage', 'Procurment Stage');
        await frm.save();

    } catch (err) {
        console.error('Error creating Material Request:', err);
        frappe.msgprint(__('There was an issue creating the Material Request.'));
    }
}

// Function to update margins for all rows in custom_bill_of_quantity
function calculateMargins(frm, cdt, cdn) {
    console.log("calculateMargins function called for", cdt, cdn);
    const row = locals[cdt][cdn];
    
    const initial_cost_per_unit = parseFloat(row.initial_cost_per_unit) || 0;
    const custom_and_clearance = parseFloat(row.custom_and_clearance) || 0;
    const additionalCost = parseFloat(row.additional_cost) || 0;
    const oh = parseFloat(row.oh) || 0;
    const logistics = parseFloat(row.logistics) || 0;
    const customiziation = parseFloat(row.customiziation) || 0;
    const stocking = parseFloat(row.stocking) || 0;
    const profitMargin = parseFloat(row.profit_margin) || 0;

    const custom_and_clearance_cost = (initial_cost_per_unit * custom_and_clearance) / 100;
    const additionalCost_value = (initial_cost_per_unit * additionalCost) / 100;
    const oh_cost = (initial_cost_per_unit * oh) / 100;
    const logistics_cost = (initial_cost_per_unit * logistics) / 100;
    const customiziation_cost = (initial_cost_per_unit * customiziation) / 100;
    const stocking_cost = (initial_cost_per_unit * stocking) / 100;

    const totalAdditionalCosts = custom_and_clearance_cost + additionalCost_value + oh_cost + logistics_cost + customiziation_cost + stocking_cost;
    const finalCost = initial_cost_per_unit + totalAdditionalCosts;

    const margin = finalCost * (profitMargin / 100);
    const finalRate = finalCost + margin;

    const roundedFinalCost = finalCost.toFixed(2);
    const roundedFinalRate = finalRate.toFixed(2);

    frappe.model.set_value(cdt, cdn, 'cost_before_margin', roundedFinalCost);
    frappe.model.set_value(cdt, cdn, 'final_rate', roundedFinalRate);
}

// Function to update field values in child table based on parent form field changes
const fieldMappings = {
    'custom_custom_and_clearnce': 'custom_and_clearnce',
    'custom_logistics': 'logisitics',
    'custom_aditional_cost': 'additional_cost',
    'custom_oh': 'oh',
    'custom_customiziation': 'customiziation',
    'custom_stocking': 'stocking',
    'custom_profit_margin': 'profit_margin'
    // Add more mappings as needed
};

// Function to update fields in child table based on parent document field changes
function updateChildTableField(frm, parentField, childField) {
    console.log(`Updating child table field: ${childField} based on parent field: ${parentField}`);
    frm.doc.custom_bill_of_quantity.forEach(row => {
        frappe.model.set_value(row.doctype, row.name, childField, frm.doc[parentField]);
    });
}

// Function to update mapped fields
function updateMappedFields(frm) {
    Object.entries(fieldMappings).forEach(([parentField, childField]) => {
        updateChildTableField(frm, parentField, childField);
    });
}

// Function to update initial cost per unit for the row
function updateInitialCostPerUnit(frm, cdt, cdn) {
    console.log("updateInitialCostPerUnit function called");
    const row = locals[cdt][cdn];
    const initial_cost_per_unit = parseFloat(row.initial_cost_per_unit) || 0;
    const cost_before_margin = parseFloat(row.cost_before_margin) || 0;

    if (cost_before_margin > 0) {
        const initial_cost = cost_before_margin / (1 + (row.profit_margin / 100));
        frappe.model.set_value(cdt, cdn, 'initial_cost_per_unit', initial_cost.toFixed(2));
    }
}

// Function to update totals
function updatetotals(frm) {
    console.log("updatetotals function called");
    let total_cost_before_margin = 0;
    let total_final_rate = 0;

    frm.doc.custom_bill_of_quantity.forEach(row => {
        total_cost_before_margin += parseFloat(row.cost_before_margin) || 0;
        total_final_rate += parseFloat(row.final_rate) || 0;
    });

    frappe.model.set_value(frm.doctype, frm.docname, 'total_cost_before_margin', total_cost_before_margin.toFixed(2));
    frappe.model.set_value(frm.doctype, frm.docname, 'total_final_rate', total_final_rate.toFixed(2));
}

// Attach event handlers
frappe.ui.form.on('Lead', {
    refresh: function(frm) {
        frm.add_custom_button(__('Update Margins'), function() {
            frm.doc.custom_bill_of_quantity.forEach(row => {
                calculateMargins(frm, row.doctype, row.name);
            });
            frm.save();
        });
        
        frm.add_custom_button(__('Initiate Pricing Request'), function() {
            createMaterialRequest(frm);
        });

        frm.add_custom_button(__('Create Items'), function() {
            createItemsFromBoQ(frm);
        });
    },
    before_save: function(frm) {
        console.log("before_save event triggered");
        frm.doc.custom_bill_of_quantity.forEach(row => {
            calculateMargins(frm, row.doctype, row.name);
            updateInitialCostPerUnit(frm, row.doctype, row.name);
        });
        updatetotals(frm);
        updateMappedFields(frm);
    },
    custom_update_margin: function(frm) {
        console.log("custom_update_margin event triggered");
        frm.doc.custom_bill_of_quantity.forEach(row => {
            calculateMargins(frm, row.doctype, row.name);
        });
        frm.save();
    },
    custom_custom_and_clearnce: function(frm) {
        updateMappedFields(frm);
    },
    custom_logistics: function(frm) {
        updateMappedFields(frm);
    },
    custom_aditional_cost: function(frm) {
        updateMappedFields(frm);
    },
    custom_oh: function(frm) {
        updateMappedFields(frm);
    },
    custom_customiziation: function(frm) {
        updateMappedFields(frm);
    },
    custom_stocking: function(frm) {
        updateMappedFields(frm);
    },
    custom_profit_margin: function(frm) {
        updateMappedFields(frm);
    },
    custom_bill_of_quantity_add: function(frm, cdt, cdn) {
        updateInitialCostPerUnit(frm, cdt, cdn);
        updatetotals(frm, cdt, cdn);
    }
});
