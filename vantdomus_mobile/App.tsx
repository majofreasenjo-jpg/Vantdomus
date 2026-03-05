import * as React from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./src/config";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { AuthScreen } from "./src/screens/AuthScreen";
import { PickHouseholdScreen } from "./src/screens/PickHouseholdScreen";
import { TasksScreen } from "./src/screens/TasksScreen";
import { FinanceScreen } from "./src/screens/FinanceScreen";
import { PersonsScreen } from "./src/screens/PersonsScreen";
import { ChatScreen } from "./src/screens/ChatScreen";
import { HealthScreen } from "./src/screens/HealthScreen";

const Stack = createNativeStackNavigator();

function useBootstrap() {
  const [ready, setReady] = React.useState(false);
  const [hasToken, setHasToken] = React.useState(false);
  React.useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem(STORAGE_KEYS.token);
      setHasToken(!!t);
      setReady(true);
    })();
  }, []);
  return { ready, hasToken };
}


export default function App() {
  const { ready, hasToken } = useBootstrap();
  if (!ready) return null;

  return (
    <NavigationContainer theme={DarkTheme}>
      <StatusBar style="light" />
      <Stack.Navigator initialRouteName={hasToken ? "Dashboard" : "Auth"}>
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PickHousehold" component={PickHouseholdScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Tasks" component={TasksScreen} />
        <Stack.Screen name="Finance" component={FinanceScreen} />
        <Stack.Screen name="Persons" component={PersonsScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Health" component={HealthScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
