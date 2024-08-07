frappe.ui.form.on('Lead', {
    refresh: function(frm) {
        // Add custom buttons
        frm.add_custom_button(__('Create Items from BoQ'), function() {
            createItemsFromBoQ(frm);
        });

        frm.page.add_inner_button(__('Material Request'), function() {
            createMaterialRequest(frm);
        }, __('Create'));

        // Validate custom_lead_stage field
        frm.cscript.custom_lead_stage = function() {
            if (frm.doc.custom_lead_stage === 'Open') {
                const allItemsCreated = frm.doc.custom_bill_of_quantity.every(row => row.is_created === 1);
                if (!allItemsCreated) {
                    frappe.msgprint('Cannot set Lead stage to "Open" until all items are created.');
                    return false;
                }
            }
            return true;
        };
    },

    // Update child table fields based on parent field changes
    custom_custom_and_clearnce: function(frm) {
        updateChildTableField(frm, 'custom_custom_and_clearnce', 'custom_and_clearnce');
    },
    custom_logistics: function(frm) {
        updateChildTableField(frm, 'custom_logistics', 'logisitics');
    },
    custom_aditional_cost: function(frm) {
        updateChildTableField(frm, 'custom_aditional_cost', 'additional_cost');
    },
    custom_oh: function(frm) {
        updateChildTableField(frm, 'custom_oh', 'oh');
    },
    custom_profit_margin: function(frm) {
        updateChildTableField(frm, 'custom_profit_margin', 'profit_margin');
    },
    custom_customiziation: function(frm) {
        updateChildTableField(frm, 'custom_customiziation', 'customiziation');
    },
    custom_stocking: function(frm) {
        updateChildTableField(frm, 'custom_stocking', 'stocking');
    },    
});

frappe.ui.form.on('Bill of Quantity', {
    initial_cost_per_unit: function(frm, cdt, cdn) {
        calculateMargins(frm, cdt, cdn);
        updatetotals(frm, cdt, cdn);
    },
    // initial_cost_per_unit: function(frm, cdt, cdn) {
    //     updatetotals(frm, cdt, cdn);
    // },    
    qty: function(frm, cdt, cdn) {
        updatetotals(frm, cdt, cdn);
    },
    initial_cost_in_product_currency: function(frm, cdt, cdn) {
        updateInitialCostPerUnit(frm, cdt, cdn);
    },
    exchange_rate: function(frm, cdt, cdn) {
        updateInitialCostPerUnit(frm, cdt, cdn);
    },
    initial_cost: function(frm, cdt, cdn) {
        calculateMargins(frm, cdt, cdn);
    },
    custom_and_clearnce: function(frm, cdt, cdn) {
        calculateMargins(frm, cdt, cdn);
    },
    logisitics: function(frm, cdt, cdn) {
        calculateMargins(frm, cdt, cdn);
    },
    additional_cost: function(frm, cdt, cdn) {
        calculateMargins(frm, cdt, cdn);
    },
    oh: function(frm, cdt, cdn) {
        calculateMargins(frm, cdt, cdn);
    },
    profit_margin: function(frm, cdt, cdn) {
        calculateMargins(frm, cdt, cdn);
    },
    customiziation: function(frm, cdt, cdn) {
        calculateMargins(frm, cdt, cdn);
    },
    stocking: function(frm, cdt, cdn) {
        calculateMargins(frm, cdt, cdn);
    },
    cost_before_margin: function(frm, cdt, cdn) {
        updatetotals(frm, cdt, cdn);
    }, 
});

// Function to create items from BoQ
async function createItemsFromBoQ(frm) {
    let items_created = 0;
    let items_skipped = 0;
    const total_items = frm.doc.custom_bill_of_quantity.length;
    const processedItemCodes = new Set();

    async function checkItemExists(hid_code) {
        try {
            return await frappe.db.exists('Item', hid_code);
        } catch (err) {
            console.error(Error checking item existence with hid_code "${hid_code}":, err);
            throw err;
        }
    }

    async function createItem(itemData) {
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
            console.error(Error creating item with hid_code "${itemData.item_code}":, err);
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
                    console.log(Item with hid_code "${row.hid_code}" already exists.);
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
                        custom_boq: frm.doc.name
                    };
                    await createItem(itemData);
                }
            } catch (err) {
                console.error(Error checking item existence with hid_code "${row.hid_code}":, err);
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
    try {
        const new_doc = frappe.model.get_new_doc('Material Request');
        new_doc.material_request_type = 'Purchase';
        new_doc.transaction_date = frappe.datetime.nowdate();
        new_doc.schedule_date = frappe.datetime.nowdate();
        new_doc.custom_from_bill_of_quantity = frm.doc.name;
        new_doc.set_warehouse = frm.doc.custom_warhouse;

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
        });

        const doc = await frappe.db.insert(new_doc);
        frappe.set_route('Form', 'Material Request', doc.name);
    } catch (err) {
        console.error('Error creating Material Request:', err);
        frappe.msgprint(__('There was an issue creating the Material Request.'));
    }
}

// Function to update margins for all rows in custom_bill_of_quantity
function calculateMargins(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    
    // Retrieve and parse values with default to 0 if undefined or NaN
    // const initial_cost_in_product_currency = parseFloat(row.initial_cost_in_product_currency) || 0;
    // const exchange_rate = parseFloat(row.exchange_rate) || 1;
    const initial_cost_per_unit = parseFloat(row.initial_cost_per_unit) || 0;
    const custom_and_clearance = parseFloat(row.custom_and_clearnce) || 0;
    const additionalCost = parseFloat(row.additional_cost) || 0;
    const oh = parseFloat(row.oh) || 0;
    const logistics = parseFloat(row.logisitics) || 0;
    const customiziation = parseFloat(row.customiziation) || 0;
    const stocking = parseFloat(row.stocking) || 0;
    const profitMargin = parseFloat(row.profit_margin) || 0;

    // Calculate cost factors based on percentage
    // const initial_cost_per_unit_value = (initial_cost_in_product_currency * exchange_rate)
    const custom_and_clearance_cost = (initial_cost_per_unit * custom_and_clearance) / 100;
    const additionalCost_value = (initial_cost_per_unit * additionalCost) / 100;
    const oh_cost = (initial_cost_per_unit * oh) / 100;
    const logistics_cost = (initial_cost_per_unit * logistics) / 100;
    const customiziation_cost = (initial_cost_per_unit * customiziation) / 100;
    const stocking_cost = (initial_cost_per_unit * stocking) / 100;

    // Calculate total additional costs and final cost
    const totalAdditionalCosts = custom_and_clearance_cost + additionalCost_value + oh_cost + logistics_cost + customiziation_cost + stocking_cost;
    const finalCost = initial_cost_per_unit + totalAdditionalCosts;

    // Calculate margin and final rate
    const margin = finalCost * (profitMargin / 100);
    const finalRate = finalCost + margin;

    // Round values to two decimal places
    const roundedFinalCost = finalCost.toFixed(2);
    const roundedFinalRate = finalRate.toFixed(2);

    // Update fields in the row
    // frappe.model.set_value(cdt, cdn, 'initial_cost_per_unit', initial_cost_per_unit_value);
    frappe.model.set_value(cdt, cdn, 'cost_before_margin', roundedFinalCost);
    frappe.model.set_value(cdt, cdn, 'final_rate', roundedFinalRate);
}

// Function to update field values in child table based on parent form field changes
function updateChildTableField(frm, parentField, childField) {
    frm.doc.custom_bill_of_quantity.forEach(row => {
        if (row[childField] !== undefined) {
            frappe.model.set_value(row.doctype, row.name, childField, frm.doc[parentField]);
        }
    });
}

// Function to update the initial cost per unit
function updateInitialCostPerUnit(frm, cdt, cdn) {
    const row = locals[cdt][cdn];

    // Retrieve values with default to 0 if undefined or NaN
    const initial_cost_in_product_currency = parseFloat(row.initial_cost_in_product_currency) || 0;
    const exchange_rate = parseFloat(row.exchange_rate) || 1;
    
    // Calculate initial cost per unit
    const initial_cost_per_unit_value = initial_cost_in_product_currency * exchange_rate;

    // Update field in the row
    frappe.model.set_value(cdt, cdn, 'initial_cost_per_unit', initial_cost_per_unit_value.toFixed(2));
}
function updatetotals(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    const initial_cost_per_unit = parseFloat(row.initial_cost_per_unit) || 0;
    const qty = parseFloat(row.qty) || 0;
    const cost_before_margin = parseFloat(row.cost_before_margin) || 0;
    const final_rate = parseFloat(row.final_rate) || 0;
    const total_before_margins_value = cost_before_margin * qty; 
    const total_cost = initial_cost_per_unit * qty;
    const total_final_value = final_rate * qty;
    frappe.model.set_value(cdt, cdn, 'initial_cost', total_cost );
    frappe.model.set_value(cdt, cdn, 'total_before_margins', total_before_margins_value );
    frappe.model.set_value(cdt, cdn, 'total_finals', total_final_value)
}


