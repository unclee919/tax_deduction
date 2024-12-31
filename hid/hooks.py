app_name = "hid"
app_title = "Decoration Sales Workflow"
app_publisher = "unclee919@gmail.com"
app_description = "Sales for decoration company"
app_email = "unclee919@gmail.com"
app_license = "gpl-3.0"

# Includes in <head>
app_include_js = [
    "/assets/hid/js/hid.bundle.js"
    # "/assets/hid/js/id.js", # Ensure this is the correct path for your new JS file
    "/assets/hid/js/Generate Codes.js",
    "/assets/hid/js/ROQ.js" ,
    "/assets/hid/js/sub_boq.js",
    "/assets/hid/js/Supplier quotation.js",
    # "/assets/hid/js/id.js"#
]

web_include_js = [
    # "/assets/hid/js/id.js",
    "/assets/hid/js/Generate Codes.js",
    "/assets/hid/js/ROQ.js" , 
    "/assets/hid/js/sub_boq.js" ,
    "/asses/hid/js/purchase_order.js"
    "/assets/js/Supplier quotation.js"# Ensure this is the correct path for your new JS file
    # "/assets/js/id.js"
]

# Add custom scripts to specific forms
doctype_js = {
    # "ID Project": "public/js/id.js",
    "Lead": "public/js/Generate Codes.js",
    "Material Request": "public/js/ROQ.js",
    
    "Purchase Order": "public/js/purchase_order.js", 
    "Supplier Quotation": "public/js/ROQ.js" # Link ROQ.js to Material Request Doctype
    # "ID Project": "public/js/id.js"
    # Add other Doctypes and their corresponding JS files if needed
    # Example: "Your Doctype": "public/js/YourScript.js"
}
# YourApp/hooks.py

scheduler_events = {
    "cron": {
        "*/15 * * * *": [
            "auto_save.auto_save_documents"  # Ensure the correct module and method paths
        ]
    }
}
override_whitelisted_methods = {
    "hid.sub_boq.map_to_lead": "hid.hid.doctype.sub_boq.sub_boq.py.map_to_lead"
}
