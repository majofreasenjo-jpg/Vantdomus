import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Mismo diccionario que en Backend/Vercel
export const INDUSTRY_PRESETS_UI: Record<string, any> = {
    default: { unit: "Unidad", persons: "Personal", tasks: "Operaciones", finance: "Presupuesto", health: "Seguridad/Fatiga" },
    mining: { unit: "Mina", persons: "Cuadrilla Minera", tasks: "Mantenimientos", finance: "Insumos", health: "Fatiga Industrial" },
    construction: { unit: "Obra", persons: "Operarios", tasks: "Avance de Obra", finance: "Materiales", health: "Accidentabilidad" },
    healthcare: { unit: "Piso Clínico", persons: "Personal Médico", tasks: "Protocolos Clínicos", finance: "Suministros", health: "Estrés/Triage" }
};

interface TaxonomyContextType {
    presetKey: string;
    tax: any;
    setTaxonomy: (preset: string) => void;
}

const TaxonomyContext = createContext<TaxonomyContextType>({
    presetKey: "default",
    tax: INDUSTRY_PRESETS_UI["default"],
    setTaxonomy: () => { }
});

export const TaxonomyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [presetKey, setPresetKey] = useState("default");

    const setTaxonomy = async (preset: string) => {
        const validPreset = INDUSTRY_PRESETS_UI[preset] ? preset : "default";
        setPresetKey(validPreset);
        await AsyncStorage.setItem("@vantunit_taxonomy", validPreset);
    };

    useEffect(() => {
        (async () => {
            const saved = await AsyncStorage.getItem("@vantunit_taxonomy");
            if (saved && INDUSTRY_PRESETS_UI[saved]) {
                setPresetKey(saved);
            }
        })();
    }, []);

    return (
        <TaxonomyContext.Provider value={{ presetKey, tax: INDUSTRY_PRESETS_UI[presetKey], setTaxonomy }}>
            {children}
        </TaxonomyContext.Provider>
    );
};

export const useTaxonomy = () => useContext(TaxonomyContext);
