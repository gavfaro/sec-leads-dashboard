from data_puller import fetch_raw_startup_data
import numpy as np
from sklearn.preprocessing import MinMaxScaler, OneHotEncoder

"""
We want to represent each startup as a matrix, eventually we will have the investors as a matrix as well. With this we can find the distance between startups and investors to identify potential matches.
S_i = [S_fin || S_cat || S_sem]^T, where S_fin is the financial features, S_cat is the categorical features, S_sem is the semantic features, and S_i is the feature vector for the i-th startup. S = [S_1, S_2, ..., S_n]
"""


# Once we get the ai_summary of each startup, we can incorporate it into the feature matrix. This would allow us to use semantic features in our machine learning models.

class StartupFeatureEncoder:
    def __init__(self):
        # MinMaxScaler scales the log-transformed financials cleanly between 0 and 1
        self.scaler = MinMaxScaler()
        
        # handle_unknown='ignore' is critical. If a new startup is from a country 
        # the engine has never seen before, it won't crash; it just maps it to zeros.
        self.ohe = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
        
        self.is_fit = False

    def fit_transform(self, raw_data: list[dict]) -> np.ndarray:
        """
        Takes the merged raw dictionaries and outputs the S matrix.
        """
        financials = []
        categories = []
        # once we have the summaries we will use an NLP model to extract semantic features. One from huggingface, but eventually train our own. 
        # semantic_features = []
        
        for row in raw_data:
            # 1. Process Financials
            # Default to 0 if the field is None, then apply log1p.
            # Log1p handles the massive magnitude difference between a $500k seed 
            # and a $100M Series C without letting outliers destroy the variance.
            raw_amount = float(row.get("TOTALOFFERINGAMOUNT") or 0)
            financials.append([np.log1p(raw_amount)])
            
            # 2. Process Categoricals
            ind = row.get("INDUSTRYGROUPTYPE") or "Unknown"
            state = row.get("STATEORCOUNTRY") or "Unknown"
            categories.append([ind, state])
            
            # # 3. Process Semantic Features
            # ai_summary = row.get("ai_summary") or "No summary available"
            # semantic_features.append([ai_summary])
            
        # 3. Execute the Scikit-Learn transformations
        if not self.is_fit:
            # First run: learn the vocabulary and the min/max bounds
            fin_scaled = self.scaler.fit_transform(financials)
            cat_encoded = self.ohe.fit_transform(categories)
            self.is_fit = True
        else:
            # Subsequent runs: strictly apply the learned bounds
            fin_scaled = self.scaler.transform(financials)
            cat_encoded = self.ohe.transform(categories)
            
        # 4. Concatenate dimensions horizontally
        # S = [S_fin || S_cat]^T
        feature_matrix = np.hstack([fin_scaled, cat_encoded])
        
        return feature_matrix




# --- Execution Example ---
# Assuming 'merged_data' is the output from your previous fetch_raw_startup_data() script
merged_data = fetch_raw_startup_data(limit=10000)
encoder = StartupFeatureEncoder()

# Process the data into the final continuous mathematical space
S_matrix = encoder.fit_transform(merged_data)

print(f"Matrix Shape: {S_matrix.shape} (Startups, Dimensions)")
print(f"Sample Startup Vector (S_0): \n{S_matrix[0]}")

# To see exactly what the One-Hot Encoder generated:
print("\nCategorical Feature Names:")
print(encoder.ohe.get_feature_names_out(["Industry", "Location"]))